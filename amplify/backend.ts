import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { createTestUsersFunction } from './functions/create-test-users/resource';
import { activeRecordProcessorFunction } from './functions/active-record-processor/resource';
import { configureStreamTriggers } from './functions/active-record-processor/stream-config';
// TODO: Re-enable stream handler once CDK integration is resolved
// import { chatStreamHandler } from './functions/chat-stream-handler/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  createTestUsersFunction,
  activeRecordProcessorFunction
  // TODO: Re-enable stream handler
  // chatStreamHandler
});

// Get environment name from various sources
const envName = process.env['AMPLIFY_BRANCH'] || 
                process.env['AWS_BRANCH'] || 
                backend.stack.node.tryGetContext('amplify-environment-name') ||
                'dev';
console.log(`🎯 Using environment name: ${envName}`);

// Configure DynamoDB streams and permissions for active record processor
configureStreamTriggers(
  backend.stack, 
  backend.activeRecordProcessorFunction.resources.lambda,
  backend.data.resources.tables
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