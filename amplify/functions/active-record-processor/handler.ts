import type { DynamoDBStreamHandler } from 'aws-lambda';
import { 
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
  AttributeValue
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});

export const handler: DynamoDBStreamHandler = async (event) => {
  console.log('DynamoDB Stream Event:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    // Only process INSERT events
    if (record.eventName !== 'INSERT') {
      console.log(`Skipping ${record.eventName} event`);
      continue;
    }

    if (!record.dynamodb?.NewImage) {
      console.log('No NewImage in record, skipping');
      continue;
    }

    try {
      const newItem = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
      const tableName = record.eventSourceARN?.split('/')[1];
      
      if (!tableName) {
        console.log('Could not extract table name from event source ARN');
        continue;
      }

      console.log(`Processing INSERT for table: ${tableName}`);
      console.log('New item:', JSON.stringify(newItem, null, 2));

      // Check if the new item has active = true
      if (newItem.active !== true) {
        console.log('New record does not have active=true, skipping');
        continue;
      }

      // Get the key schema for this table to properly identify records
      const keyFields = getKeyFields(newItem);
      const newItemKey = getItemKey(newItem, keyFields);
      
      console.log('New item key:', JSON.stringify(newItemKey, null, 2));

      // Scan for all records with active = true, excluding the newly inserted record
      await deactivateOtherRecords(tableName, newItemKey, keyFields);
      
    } catch (error) {
      console.error('Error processing record:', error);
      // Continue processing other records even if one fails
    }
  }
};

function getKeyFields(item: any): string[] {
  // For composite keys, we need both id and version
  if (item.id && item.version) {
    return ['id', 'version'];
  }
  // Fallback to just id if no version
  return ['id'];
}

function getItemKey(item: any, keyFields: string[]): Record<string, any> {
  const key: Record<string, any> = {};
  for (const field of keyFields) {
    if (item[field] !== undefined) {
      key[field] = item[field];
    }
  }
  return key;
}

async function deactivateOtherRecords(
  tableName: string, 
  newItemKey: Record<string, any>,
  keyFields: string[]
): Promise<void> {
  try {
    // Try to use the GSI index first, fallback to scan if GSI doesn't exist
    let totalProcessed = 0;
    
    try {
      // Use Query on the active GSI (index name follows pattern: gsi-active-createdAt)
      const indexName = `gsi-active-createdAt`;
      
      const queryCommand = new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: '#active = :activeValue',
        ExpressionAttributeNames: {
          '#active': 'active'
        },
        ExpressionAttributeValues: marshall({
          ':activeValue': true
        }),
        Limit: 50 // Higher limit since query is more efficient
      });

      const queryResult = await dynamoClient.send(queryCommand);
      
      if (!queryResult.Items || queryResult.Items.length === 0) {
        console.log('No active records found in GSI');
        return;
      }

      console.log(`Found ${queryResult.Items.length} active records using GSI`);

      // Process each active record
      for (const item of queryResult.Items) {
        const unmarshalledItem = unmarshall(item);
        const itemKey = getItemKey(unmarshalledItem, keyFields);
        
        // Skip the newly inserted record
        const isNewRecord = keyFields.every(field => 
          itemKey[field] === newItemKey[field]
        );
        
        if (isNewRecord) {
          console.log('Skipping newly inserted record:', JSON.stringify(itemKey, null, 2));
          continue;
        }

        // Remove the active attribute from this record
        await removeActiveAttribute(tableName, itemKey, keyFields);
        totalProcessed++;
      }

    } catch (gsiError) {
      console.log('GSI not available or error querying GSI, falling back to scan:', gsiError);
      
      // Fallback to scan operation with pagination
      let lastEvaluatedKey: Record<string, AttributeValue> | undefined;

      do {
        const scanCommand = new ScanCommand({
          TableName: tableName,
          FilterExpression: '#active = :activeValue',
          ExpressionAttributeNames: {
            '#active': 'active'
          },
          ExpressionAttributeValues: marshall({
            ':activeValue': true
          }),
          Limit: 25,
          ExclusiveStartKey: lastEvaluatedKey
        });

        const scanResult = await dynamoClient.send(scanCommand);
        
        if (!scanResult.Items || scanResult.Items.length === 0) {
          console.log(`No more active records found (processed ${totalProcessed} total)`);
          break;
        }

        console.log(`Found ${scanResult.Items.length} active records in this batch`);

        for (const item of scanResult.Items) {
          const unmarshalledItem = unmarshall(item);
          const itemKey = getItemKey(unmarshalledItem, keyFields);
          
          const isNewRecord = keyFields.every(field => 
            itemKey[field] === newItemKey[field]
          );
          
          if (isNewRecord) {
            console.log('Skipping newly inserted record:', JSON.stringify(itemKey, null, 2));
            continue;
          }

          await removeActiveAttribute(tableName, itemKey, keyFields);
          totalProcessed++;
        }

        lastEvaluatedKey = scanResult.LastEvaluatedKey;
        
      } while (lastEvaluatedKey);
    }

    console.log(`Completed processing. Total records deactivated: ${totalProcessed}`);

  } catch (error) {
    console.error('Error deactivating other records:', error);
    throw error;
  }
}

async function removeActiveAttribute(
  tableName: string, 
  itemKey: Record<string, any>,
  keyFields: string[]
): Promise<void> {
  try {
    // Build the key for the update operation
    const key: Record<string, AttributeValue> = {};
    for (const field of keyFields) {
      key[field] = marshall(itemKey[field])[field];
    }

    const updateCommand = new UpdateItemCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: 'REMOVE #active',
      ExpressionAttributeNames: {
        '#active': 'active'
      },
      // Only update if the record still has the active attribute
      ConditionExpression: 'attribute_exists(#active)'
    });

    await dynamoClient.send(updateCommand);
    console.log(`Removed active attribute from record:`, JSON.stringify(itemKey, null, 2));
    
  } catch (error: any) {
    // If condition fails, it means the record doesn't have active attribute anymore
    if (error.name === 'ConditionalCheckFailedException') {
      console.log(`Record already lacks active attribute:`, JSON.stringify(itemKey, null, 2));
    } else {
      console.error(`Error removing active attribute:`, error);
      throw error;
    }
  }
}