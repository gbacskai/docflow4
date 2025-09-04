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
  console.log('🚀 LAMBDA TRIGGERED - DynamoDB Stream Event received');
  console.log('Event details:', JSON.stringify(event, null, 2));
  console.log('Number of records:', event.Records.length);
  
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
    let totalProcessed = 0;
    console.log(`Processing table: ${tableName}`);
    console.log(`New item key: ${JSON.stringify(newItemKey, null, 2)}`);
    
    // First, try to query for existing active records using a more efficient approach
    // Since we can't use GSI with boolean fields, we'll use scan but with better filtering
    // and we'll exclude the current record's version from the start
    let lastEvaluatedKey: Record<string, AttributeValue> | undefined;

    do {
      const scanCommand = new ScanCommand({
        TableName: tableName,
        FilterExpression: '#id = :idValue AND #active = :activeValue AND #version <> :currentVersion',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#active': 'active',
          '#version': 'version'
        },
        ExpressionAttributeValues: marshall({
          ':idValue': newItemKey.id,
          ':activeValue': true,
          ':currentVersion': newItemKey.version
        }),
        Limit: 50,
        ExclusiveStartKey: lastEvaluatedKey
      });

      const scanResult = await dynamoClient.send(scanCommand);
      
      if (!scanResult.Items || scanResult.Items.length === 0) {
        if (totalProcessed === 0) {
          console.log(`No other active records found for ID ${newItemKey.id} - this is the first active record`);
        } else {
          console.log(`No more active records found for ID ${newItemKey.id} (processed ${totalProcessed} total)`);
        }
        break;
      }

      console.log(`Found ${scanResult.Items.length} older active records for ID ${newItemKey.id} in this batch`);

      for (const item of scanResult.Items) {
        const unmarshalledItem = unmarshall(item);
        const itemKey = getItemKey(unmarshalledItem, keyFields);
        
        console.log(`Deactivating older record:`, JSON.stringify(itemKey, null, 2));

        // Remove the active attribute from this older record
        await removeActiveAttribute(tableName, itemKey, keyFields);
        totalProcessed++;
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
      
    } while (lastEvaluatedKey);

    console.log(`Completed processing for ID ${newItemKey.id}. Total older records deactivated: ${totalProcessed}`);

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