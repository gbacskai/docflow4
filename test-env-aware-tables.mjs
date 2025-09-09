import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signIn } from 'aws-amplify/auth';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import outputs from './amplify_outputs.json' with { type: 'json' };

Amplify.configure(outputs);

async function testEnvironmentAwareTableLoading() {
  try {
    console.log('🧪 Testing environment-aware table loading...');
    
    // Get environment name from outputs like the admin component does
    const environmentName = outputs?.custom?.environmentName || 'dev001';
    console.log('🎯 Environment name from outputs:', environmentName);
    
    // Sign in
    await signIn({
      username: 'test_admin@docflow4.com',
      password: 'TestPass123!'
    });
    
    // Get credentials
    const session = await fetchAuthSession();
    const credentials = session.credentials;
    
    // Create DynamoDB client
    const dynamoClient = new DynamoDBClient({
      region: 'ap-southeast-2',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken
      }
    });
    
    // List tables
    const listTablesCommand = new ListTablesCommand({});
    const tablesResult = await dynamoClient.send(listTablesCommand);
    
    // Use the new filtering logic with environment awareness
    const docflowTables = tablesResult.TableNames?.filter(tableName => {
      if (!tableName) return false;
      const lowerName = tableName.toLowerCase();
      
      // Check for DocFlow4 model names
      const isDocFlowModel = lowerName.includes('project') ||
                            lowerName.includes('document') ||
                            lowerName.includes('user') ||
                            lowerName.includes('workflow') ||
                            lowerName.includes('chatroom') ||
                            lowerName.includes('chatmessage');
      
      // Check for DocFlow4 app name or environment
      const isDocFlowApp = lowerName.includes('docflow') ||
                          lowerName.includes(environmentName.toLowerCase());
      
      // Include tables that match our naming pattern or contain our models
      return isDocFlowModel || isDocFlowApp;
    }) || [];
    
    console.log(`\n✅ Found ${docflowTables.length} DocFlow4 tables with environment-aware filtering:`);
    
    // Group by model type
    const models = ['project', 'document', 'user', 'workflow', 'chatroom', 'chatmessage'];
    
    models.forEach(model => {
      const modelTables = docflowTables.filter(name => 
        name.toLowerCase().includes(model)
      );
      if (modelTables.length > 0) {
        console.log(`\n📊 ${model.toUpperCase()} tables:`);
        modelTables.forEach(tableName => {
          const envSuffix = tableName.includes(environmentName) ? ` (${environmentName})` : '';
          console.log(`  - ${tableName}${envSuffix}`);
        });
      }
    });
    
    console.log(`\n🎯 Environment filtering working for: ${environmentName}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEnvironmentAwareTableLoading();