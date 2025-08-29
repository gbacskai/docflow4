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

// Override GraphQL table names to use our naming convention
const envName = process.env['ENV'] || process.env['AMPLIFY_BRANCH'] || 'dev';
const appName = 'docflow4';

console.log(`🔧 Overriding GraphQL table names with pattern: ${appName}-{TableName}-${envName}`);

// Access the GraphQL tables and override their names
const graphqlTables = backend.data.resources.tables;
Object.keys(graphqlTables).forEach(tableName => {
  const table = graphqlTables[tableName];
  const cfnTable = table.node.defaultChild as any;
  const newTableName = `${appName}-${tableName}-${envName}`;
  
  if (cfnTable && cfnTable.addPropertyOverride) {
    cfnTable.addPropertyOverride('TableName', newTableName);
    console.log(`✅ GraphQL table renamed: ${tableName} -> ${newTableName}`);
  }
});

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