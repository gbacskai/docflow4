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

// Configure DynamoDB streams and permissions for active record processor  
// Use the auto-generated tables from the data resource
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

// Export environment name for admin component
backend.addOutput({
  custom: {
    environmentName: envName,
    appName: 'docflow4'
  }
});