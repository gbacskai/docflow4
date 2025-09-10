const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { fromCognitoIdentityPool } = require('@aws-sdk/credential-providers');

// Configure AWS credentials
const client = new DynamoDBClient({
  region: 'ap-southeast-2',
  credentials: fromCognitoIdentityPool({
    identityPoolId: 'ap-southeast-2:62194cb0-fcb9-46ec-bf9f-6e60874bf998',
    clientConfig: { region: 'ap-southeast-2' },
  }),
});

const docClient = DynamoDBDocumentClient.from(client);

// Table names based on current environment
const tableNames = [
  'Project-tozuziswmfcitm3lnmsv4ij7nq-sandbox-00012',
  'Document-tozuziswmfcitm3lnmsv4ij7nq-sandbox-00012',
  'User-tozuziswmfcitm3lnmsv4ij7nq-sandbox-00012',
  'DocumentType-tozuziswmfcitm3lnmsv4ij7nq-sandbox-00012',
  'Workflow-tozuziswmfcitm3lnmsv4ij7nq-sandbox-00012',
  'ChatRoom-tozuziswmfcitm3lnmsv4ij7nq-sandbox-00012',
  'ChatMessage-tozuziswmfcitm3lnmsv4ij7nq-sandbox-00012'
];

async function fixCreatedAtForTable(tableName) {
  console.log(`\n🔧 Processing table: ${tableName}`);
  
  try {
    // Scan the table to get all items
    const scanCommand = new ScanCommand({
      TableName: tableName
    });
    
    const result = await docClient.send(scanCommand);
    const items = result.Items || [];
    
    console.log(`📊 Found ${items.length} items in ${tableName}`);
    
    let updatedCount = 0;
    
    for (const item of items) {
      // Check if createdAt is missing or null
      if (!item.createdAt && item.updatedAt) {
        try {
          const updateCommand = new UpdateCommand({
            TableName: tableName,
            Key: {
              id: item.id,
              version: item.version
            },
            UpdateExpression: 'SET createdAt = :createdAt',
            ExpressionAttributeValues: {
              ':createdAt': item.updatedAt // Use updatedAt as createdAt
            }
          });
          
          await docClient.send(updateCommand);
          updatedCount++;
          console.log(`✅ Updated record ${item.id} (version: ${item.version})`);
        } catch (error) {
          console.error(`❌ Failed to update record ${item.id}:`, error.message);
        }
      }
    }
    
    console.log(`🎉 Updated ${updatedCount} records in ${tableName}`);
    
  } catch (error) {
    console.error(`❌ Error processing ${tableName}:`, error.message);
  }
}

async function fixAllTables() {
  console.log('🚀 Starting createdAt field fix for all tables...');
  
  for (const tableName of tableNames) {
    await fixCreatedAtForTable(tableName);
  }
  
  console.log('\n✨ Completed fixing createdAt fields for all tables!');
}

// Run the fix
fixAllTables().catch(console.error);