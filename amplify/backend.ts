import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
// TODO: Re-enable stream handler once CDK integration is resolved
// import { chatStreamHandler } from './functions/chat-stream-handler/resource';

const backend = defineBackend({
  auth,
  data,
  storage
  // TODO: Re-enable stream handler
  // chatStreamHandler
});

// Get environment name from various sources
const envName = process.env['AMPLIFY_BRANCH'] || 
                process.env['AWS_BRANCH'] || 
                backend.stack.node.tryGetContext('amplify-environment-name') ||
                'dev';
console.log(`🎯 Using environment name: ${envName}`);

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