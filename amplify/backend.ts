import { defineBackend } from '@aws-amplify/backend';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
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
const envName = process.env['AWS_BRANCH'] || 'dev001';
console.log(`🎯 Using environment name: ${envName}`);

// Configure DynamoDB streams and permissions for active record processor
configureStreamTriggers(
  backend.stack, 
  backend.activeRecordProcessorFunction.resources.lambda,
  backend.data.resources.tables
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

// Export GraphQL table names for verification
backend.addOutput({
  custom: {
    graphqlTableNames: Object.keys(backend.data.resources.tables).reduce((acc, tableName) => {
      const finalName = `docflow4-${tableName}-${envName}`;
      acc[`${tableName}TableName`] = finalName;
      return acc;
    }, {} as Record<string, string>),
    environmentName: envName
  }
});