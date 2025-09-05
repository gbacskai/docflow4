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

// For sandbox environments, we need to detect if we're running in sandbox mode
// During synthesis, env vars aren't always available, so we'll use a different approach
// Check if the current directory or process indicates sandbox mode
const isLikelySandbox = process.argv.some(arg => arg.includes('sandbox')) ||
                       process.cwd().includes('sandbox') ||
                       process.env['AWS_STACK_NAME']?.includes('sandbox') ||
                       baseEnvName === 'sandbox';

// Extract sandbox ID from command line args or environment
const sandboxIdFromArgs = process.argv.find(arg => arg.startsWith('--identifier'))?.split('=')[1] ||
                         process.argv[process.argv.indexOf('--identifier') + 1];

const sandboxId = process.env['AMPLIFY_SANDBOX_ID'] || 
                  process.env['SANDBOX_ID'] ||
                  sandboxIdFromArgs ||
                  '00004'; // Default fallback

// If we detect sandbox indicators, use sandbox naming
const isSandbox = isLikelySandbox || sandboxIdFromArgs;
const envName = isSandbox ? `sandbox-${sandboxId}` : baseEnvName;

console.log(`🎯 Using environment name: ${envName}${isSandbox ? ` (sandbox with ID: ${sandboxId})` : ''}`);
console.log(`📋 Detection details:`, {
  AWS_BRANCH: process.env['AWS_BRANCH'],
  AWS_STACK_NAME: process.env['AWS_STACK_NAME'],
  AMPLIFY_SANDBOX_ID: process.env['AMPLIFY_SANDBOX_ID'],
  sandboxIdFromArgs: sandboxIdFromArgs,
  isLikelySandbox: isLikelySandbox,
  isSandbox: isSandbox,
  sandboxId: sandboxId,
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

// Add custom tables as external data sources for GraphQL API
backend.data.addDynamoDbDataSource('ExternalUserTableDataSource', customUserTable);
backend.data.addDynamoDbDataSource('ExternalProjectTableDataSource', customProjectTable);
backend.data.addDynamoDbDataSource('ExternalDocumentTableDataSource', customDocumentTable);
backend.data.addDynamoDbDataSource('ExternalDocumentTypeTableDataSource', customDocumentTypeTable);
backend.data.addDynamoDbDataSource('ExternalWorkflowTableDataSource', customWorkflowTable);
backend.data.addDynamoDbDataSource('ExternalChatRoomTableDataSource', customChatRoomTable);
backend.data.addDynamoDbDataSource('ExternalChatMessageTableDataSource', customChatMessageTable);

console.log(`🔗 External data sources added for custom tables`);

// Configure DynamoDB streams and permissions for active record processor  
// Use our custom tables directly instead of auto-generated ones
const allTables = {
  'Project': customProjectTable,
  'Document': customDocumentTable,
  'User': customUserTable,
  'DocumentType': customDocumentTypeTable,
  'Workflow': customWorkflowTable,
  'ChatRoom': customChatRoomTable,
  'ChatMessage': customChatMessageTable
};

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