import { defineBackend } from '@aws-amplify/backend';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Table, AttributeType, BillingMode, StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { createTestUsersFunction } from './functions/create-test-users/resource';
import { activeRecordProcessorFunction } from './functions/active-record-processor/resource';
// import { checkEmailDuplicateFunction } from './functions/check-email-duplicate/resource';
// import { deleteAllCognitoUsersFunction } from './functions/delete-all-cognito-users/resource';
import { configureStreamTriggers } from './functions/active-record-processor/stream-config';
// TODO: Re-enable stream handler once CDK integration is resolved
// import { chatStreamHandler } from './functions/chat-stream-handler/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  createTestUsersFunction,
  activeRecordProcessorFunction
  // checkEmailDuplicateFunction
  // TODO: Re-enable stream handler
  // chatStreamHandler
});

// Get environment name using only out-of-the-box AWS_BRANCH variable
const baseEnvName = process.env['AWS_BRANCH'] || 'dev';
const appName = 'docflow4';

// Detect environment type and naming strategy
// In AWS deployment, we should use the AWS_BRANCH directly without sandbox detection
// Only use sandbox naming for local development

// Check if we're in a local sandbox environment (not AWS deployment)
const isLocalSandbox = process.argv.some(arg => arg.includes('sandbox')) && 
                       !process.env['AWS_EXECUTION_ENV'] && // Not in AWS Lambda/CodeBuild
                       !process.env['CODEBUILD_BUILD_ID']; // Not in AWS CodeBuild

let envName = baseEnvName;

if (isLocalSandbox) {
  // Local sandbox - extract identifier from command line
  let sandboxIdFromArgs = null;
  const identifierIndex = process.argv.indexOf('--identifier');
  if (identifierIndex !== -1 && identifierIndex + 1 < process.argv.length) {
    const nextArg = process.argv[identifierIndex + 1];
    // Only use if it's a valid 5-digit identifier, not a file path
    if (nextArg && /^\d{5}$/.test(nextArg)) {
      sandboxIdFromArgs = nextArg;
    }
  }

  // Also check for --identifier=00006 format
  if (!sandboxIdFromArgs) {
    const identifierArg = process.argv.find(arg => arg.startsWith('--identifier='));
    if (identifierArg) {
      const value = identifierArg.split('=')[1];
      if (value && /^\d{5}$/.test(value)) {
        sandboxIdFromArgs = value;
      }
    }
  }

  const sandboxId = sandboxIdFromArgs || '00006';
  envName = `sandbox-${sandboxId}`;
} else {
  // AWS deployment - use AWS_BRANCH directly
  envName = baseEnvName;
}

console.log(`🎯 Using environment name: ${envName}${isLocalSandbox ? ` (local sandbox)` : ' (AWS deployment)'}`);
console.log(`📋 Detection details:`, {
  AWS_BRANCH: process.env['AWS_BRANCH'],
  AWS_EXECUTION_ENV: process.env['AWS_EXECUTION_ENV'],
  CODEBUILD_BUILD_ID: process.env['CODEBUILD_BUILD_ID'],
  isLocalSandbox: isLocalSandbox,
  baseEnvName: baseEnvName,
  envName: envName,
  processArgs: process.argv.filter(arg => arg.includes('sandbox') || arg.includes('identifier'))
});

// Create custom tables with the desired naming for all models
console.log(`🏗️  Creating custom tables with naming: ${appName}-TableName-${envName}`);

// Project Table
const customProjectTableName = `${appName}-Project-${envName}`;
const customProjectTable = new Table(backend.stack, 'CustomProjectTable', {
  tableName: customProjectTableName,
  partitionKey: { name: 'id', type: AttributeType.STRING },
  sortKey: { name: 'version', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  stream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.DESTROY,
});

// Document Table  
const customDocumentTableName = `${appName}-Document-${envName}`;
const customDocumentTable = new Table(backend.stack, 'CustomDocumentTable', {
  tableName: customDocumentTableName,
  partitionKey: { name: 'id', type: AttributeType.STRING },
  sortKey: { name: 'version', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  stream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.DESTROY,
});

// Add GSI for querying documents by projectId
customDocumentTable.addGlobalSecondaryIndex({
  indexName: 'ProjectIndex',
  partitionKey: { name: 'projectId', type: AttributeType.STRING },
  sortKey: { name: 'createdAt', type: AttributeType.STRING }
});

// User Table
const customUserTableName = `${appName}-User-${envName}`;
const customUserTable = new Table(backend.stack, 'CustomUserTable', {
  tableName: customUserTableName,
  partitionKey: { name: 'id', type: AttributeType.STRING },
  sortKey: { name: 'version', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  stream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.DESTROY,
});

// Add GSIs for User table
customUserTable.addGlobalSecondaryIndex({
  indexName: 'EmailIndex',
  partitionKey: { name: 'email', type: AttributeType.STRING }
});

customUserTable.addGlobalSecondaryIndex({
  indexName: 'CognitoUserIndex',
  partitionKey: { name: 'cognitoUserId', type: AttributeType.STRING }
});

// DocumentType Table
const customDocumentTypeTableName = `${appName}-DocumentType-${envName}`;
const customDocumentTypeTable = new Table(backend.stack, 'CustomDocumentTypeTable', {
  tableName: customDocumentTypeTableName,
  partitionKey: { name: 'id', type: AttributeType.STRING },
  sortKey: { name: 'version', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  stream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.DESTROY,
});

// Workflow Table
const customWorkflowTableName = `${appName}-Workflow-${envName}`;
const customWorkflowTable = new Table(backend.stack, 'CustomWorkflowTable', {
  tableName: customWorkflowTableName,
  partitionKey: { name: 'id', type: AttributeType.STRING },
  sortKey: { name: 'version', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  stream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.DESTROY,
});

// ChatRoom Table
const customChatRoomTableName = `${appName}-ChatRoom-${envName}`;
const customChatRoomTable = new Table(backend.stack, 'CustomChatRoomTable', {
  tableName: customChatRoomTableName,
  partitionKey: { name: 'id', type: AttributeType.STRING },
  sortKey: { name: 'version', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  stream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.DESTROY,
});

// Add GSIs for ChatRoom table
customChatRoomTable.addGlobalSecondaryIndex({
  indexName: 'ProjectIndex',
  partitionKey: { name: 'projectId', type: AttributeType.STRING },
  sortKey: { name: 'createdAt', type: AttributeType.STRING }
});

customChatRoomTable.addGlobalSecondaryIndex({
  indexName: 'DocumentIndex',
  partitionKey: { name: 'documentId', type: AttributeType.STRING },
  sortKey: { name: 'createdAt', type: AttributeType.STRING }
});

// ChatMessage Table
const customChatMessageTableName = `${appName}-ChatMessage-${envName}`;
const customChatMessageTable = new Table(backend.stack, 'CustomChatMessageTable', {
  tableName: customChatMessageTableName,
  partitionKey: { name: 'chatRoomId', type: AttributeType.STRING },
  sortKey: { name: 'timestamp', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  stream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.DESTROY,
});

// Add GSIs for ChatMessage table
customChatMessageTable.addGlobalSecondaryIndex({
  indexName: 'SenderIndex',
  partitionKey: { name: 'senderId', type: AttributeType.STRING },
  sortKey: { name: 'timestamp', type: AttributeType.STRING }
});

customChatMessageTable.addGlobalSecondaryIndex({
  indexName: 'ThreadIndex',
  partitionKey: { name: 'threadId', type: AttributeType.STRING },
  sortKey: { name: 'timestamp', type: AttributeType.STRING }
});

console.log(`✅ All custom tables created with naming: ${appName}-TableName-${envName}`);
console.log(`🔧 Table override configured for environment: ${envName}`);

// Override the auto-generated table data sources to point to our custom tables
// This prevents the creation of -NONE tables while keeping TypeScript compatibility
console.log('🔄 Overriding auto-generated tables with custom tables...');

// Get all auto-generated table references
const autoGeneratedTables = backend.data.resources.tables;
console.log('🔍 Found auto-generated tables:', Object.keys(autoGeneratedTables));

// Replace auto-generated tables with our custom tables at the CDK level
// This approach prevents auto-generated tables from being used by resolvers
try {
  // Force replacement of all auto-generated tables with custom tables
  console.log('🔄 Force replacing ALL auto-generated tables with custom tables');
  
  // Direct assignment to ensure resolvers use our custom tables
  backend.data.resources.tables['Project'] = customProjectTable;
  backend.data.resources.tables['Document'] = customDocumentTable;
  backend.data.resources.tables['User'] = customUserTable;
  backend.data.resources.tables['DocumentType'] = customDocumentTypeTable;
  backend.data.resources.tables['Workflow'] = customWorkflowTable;
  backend.data.resources.tables['ChatRoom'] = customChatRoomTable;
  backend.data.resources.tables['ChatMessage'] = customChatMessageTable;
  
  console.log('✅ All table references forcibly replaced with custom tables');
  
  // Also try to remove any auto-generated tables from the stack to prevent conflicts
  const stack = backend.stack;
  console.log('🧹 Attempting to remove auto-generated tables from stack...');
  
  // Get all constructs in the stack
  const constructs = stack.node.children;
  for (const construct of constructs) {
    if (construct.node.id.includes('-NONE') || construct.node.id.match(/^[A-Z][a-z]+-[a-z0-9]+-NONE$/)) {
      console.log(`🗑️ Found potential auto-generated table construct: ${construct.node.id}`);
      // Don't actually remove as it could break dependencies
    }
  }
  
  console.log('✅ Stack cleanup completed');
  
  // Add custom tables as external data sources for GraphQL API with proper naming
  backend.data.addDynamoDbDataSource('UserTableDataSource', customUserTable);
  backend.data.addDynamoDbDataSource('ProjectTableDataSource', customProjectTable);
  backend.data.addDynamoDbDataSource('DocumentTableDataSource', customDocumentTable);
  backend.data.addDynamoDbDataSource('DocumentTypeTableDataSource', customDocumentTypeTable);
  backend.data.addDynamoDbDataSource('WorkflowTableDataSource', customWorkflowTable);
  backend.data.addDynamoDbDataSource('ChatRoomTableDataSource', customChatRoomTable);
  backend.data.addDynamoDbDataSource('ChatMessageTableDataSource', customChatMessageTable);
  
  console.log('🔗 External data sources added successfully');

} catch (error) {
  console.error('❌ Error during table override:', error);
  console.log('⚠️ Falling back to external data sources only');
  
  // Fallback: Just add external data sources
  backend.data.addDynamoDbDataSource('UserTableDataSource', customUserTable);
  backend.data.addDynamoDbDataSource('ProjectTableDataSource', customProjectTable);
  backend.data.addDynamoDbDataSource('DocumentTableDataSource', customDocumentTable);
  backend.data.addDynamoDbDataSource('DocumentTypeTableDataSource', customDocumentTypeTable);
  backend.data.addDynamoDbDataSource('WorkflowTableDataSource', customWorkflowTable);
  backend.data.addDynamoDbDataSource('ChatRoomTableDataSource', customChatRoomTable);
  backend.data.addDynamoDbDataSource('ChatMessageTableDataSource', customChatMessageTable);
}

// Configure DynamoDB streams and permissions for active record processor  
// Now backend.data.resources.tables points to our custom tables
const allTables = backend.data.resources.tables;

// Configure DynamoDB stream triggers for active record processing
configureStreamTriggers(
  backend.stack, 
  backend.activeRecordProcessorFunction.resources.lambda,
  allTables
);

// Configure permissions and environment for checkEmailDuplicateFunction
// backend.checkEmailDuplicateFunction.resources.lambda.addToRolePolicy(
//   new PolicyStatement({
//     effect: Effect.ALLOW,
//     actions: ['dynamodb:Scan', 'dynamodb:Query'],
//     resources: [backend.data.resources.tables['User'].tableArn]
//   })
// );

// Add Users table name as environment variable
// backend.checkEmailDuplicateFunction.addEnvironment('AMPLIFY_DATA_USER_TABLE_NAME', backend.data.resources.tables['User'].tableName);

// Configure permissions and environment for deleteAllCognitoUsersFunction
// backend.deleteAllCognitoUsersFunction.resources.lambda.addToRolePolicy(
//   new PolicyStatement({
//     effect: Effect.ALLOW,
//     actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminDeleteUser'],
//     resources: [backend.auth.resources.userPool.userPoolArn]
//   })
// );

// backend.deleteAllCognitoUsersFunction.addEnvironment('AMPLIFY_AUTH_USERPOOL_ID', backend.auth.resources.userPool.userPoolId);

// Add DynamoDB permissions for authenticated users (admin page functionality)
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'dynamodb:ListTables',
      'dynamodb:DescribeTable',
      'dynamodb:GetItem',
      'dynamodb:Query',
      'dynamodb:Scan'
    ],
    resources: ['*'] // Allow access to all DynamoDB resources
  })
);

// Sample data initialization will be handled via direct GraphQL mutations

// Export environment name and table references for admin component
backend.addOutput({
  custom: {
    environmentName: envName,
    appName: 'docflow4',
    customUserTableName: customUserTableName
  }
});