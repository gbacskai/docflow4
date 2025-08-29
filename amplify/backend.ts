import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
// TODO: Re-enable stream handler once CDK integration is resolved
// import { chatStreamHandler } from './functions/chat-stream-handler/resource';

// Set environment context before defining backend
const appName = 'docflow4';
const envName = process.env['ENV'] || process.env['AMPLIFY_BRANCH'] || 'dev';
console.log(`🎯 Setting environment context to: ${envName}`);

const backend = defineBackend({
  auth,
  data,
  storage
  // TODO: Re-enable stream handler
  // chatStreamHandler
});

// Context will be set automatically by Amplify based on the branch
console.log(`📝 Environment context will be handled by Amplify pipeline: ${envName}`);

// Export GraphQL table names for verification
backend.addOutput({
  custom: {
    graphqlTableNames: Object.keys(backend.data.resources.tables).reduce((acc, tableName) => {
      const finalName = `${appName}-${tableName}-${envName}`;
      acc[`${tableName}TableName`] = finalName;
      return acc;
    }, {} as Record<string, string>)
  }
});