#!/usr/bin/env node

const { 
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand
} = require('@aws-sdk/client-dynamodb');
const { fromIni } = require('@aws-sdk/credential-providers');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

// Read amplify_outputs.json to get table info
const fs = require('fs');
const path = require('path');

const amplifyOutputsPath = path.join(__dirname, '..', 'amplify_outputs.json');
if (!fs.existsSync(amplifyOutputsPath)) {
  console.log('⚠️  amplify_outputs.json not found');
  process.exit(0);
}

const amplifyOutputs = JSON.parse(fs.readFileSync(amplifyOutputsPath, 'utf8'));
const region = amplifyOutputs.auth.aws_region || 'ap-southeast-2';

const dynamoClient = new DynamoDBClient({
  region,
  credentials: fromIni({ profile: 'aws_amplify_docflow4' })
});

async function cleanupActiveRecords() {
  console.log('🧹 Cleaning up duplicate active User records...');
  
  // Get the actual table name from amplify outputs
  const tableName = amplifyOutputs.custom?.graphqlTableNames?.UserTableName || 'docflow4-User-dev001';
  
  try {
    // Scan for all active User records
    const scanCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: '#active = :activeValue',
      ExpressionAttributeNames: {
        '#active': 'active'
      },
      ExpressionAttributeValues: marshall({
        ':activeValue': true
      })
    });

    const result = await dynamoClient.send(scanCommand);
    
    if (!result.Items || result.Items.length === 0) {
      console.log('No active records found');
      return;
    }

    console.log(`Found ${result.Items.length} active records`);
    
    // Group by id to find duplicates
    const recordsById = {};
    
    for (const item of result.Items) {
      const record = unmarshall(item);
      const id = record.id;
      
      if (!recordsById[id]) {
        recordsById[id] = [];
      }
      recordsById[id].push(record);
    }
    
    let totalDeactivated = 0;
    
    // For each ID with multiple active records, keep only the latest
    for (const [id, records] of Object.entries(recordsById)) {
      if (records.length <= 1) {
        console.log(`✅ User ${id} has only one active record`);
        continue;
      }
      
      console.log(`🔄 User ${id} has ${records.length} active records - cleaning up...`);
      
      // Sort by version (newest first)
      records.sort((a, b) => new Date(b.version).getTime() - new Date(a.version).getTime());
      
      // Keep the first (newest), deactivate the rest
      for (let i = 1; i < records.length; i++) {
        const recordToDeactivate = records[i];
        
        try {
          const updateCommand = new UpdateItemCommand({
            TableName: tableName,
            Key: {
              id: { S: recordToDeactivate.id },
              version: { S: recordToDeactivate.version }
            },
            UpdateExpression: 'REMOVE #active',
            ExpressionAttributeNames: {
              '#active': 'active'
            },
            ConditionExpression: 'attribute_exists(#active)'
          });

          await dynamoClient.send(updateCommand);
          console.log(`   ✅ Deactivated version ${recordToDeactivate.version}`);
          totalDeactivated++;
          
        } catch (error) {
          console.log(`   ❌ Failed to deactivate version ${recordToDeactivate.version}:`, error.message);
        }
      }
    }
    
    console.log(`\n🎉 Cleanup complete! Deactivated ${totalDeactivated} duplicate records`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupActiveRecords().catch(console.error);