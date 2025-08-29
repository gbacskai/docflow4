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

// Force the environment name by setting CDK context
const app = backend.stack.node.scope as any;
if (app && app.node && app.node.setContext) {
  app.node.setContext('amplify-environment-name', envName);
  console.log(`📝 Set CDK context 'amplify-environment-name' to: ${envName}`);
}

// Also try setting the environment name directly on the stack
backend.stack.node.setContext('amplify-environment-name', envName);
backend.stack.node.setContext('amplify-backend-name', envName);
console.log(`📝 Set stack context to environment: ${envName}`);

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