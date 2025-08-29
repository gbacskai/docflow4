import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { storage } from './storage/resource';
// TODO: Re-enable stream handler once CDK integration is resolved
// import { chatStreamHandler } from './functions/chat-stream-handler/resource';
import { createAllTables } from './custom-resources/all-tables';

const backend = defineBackend({
  auth,
  storage
  // TODO: Re-enable stream handler
  // chatStreamHandler
  // NOTE: Removed 'data' resource to prevent Amplify from creating tables with random names
});

// Add custom DynamoDB tables for all models with proper naming
// TODO: Re-enable stream handler once CDK integration is resolved
const { 
  projectTable, 
  documentTable, 
  userTable, 
  documentTypeTable, 
  domainTable, 
  chatRoomTable, 
  chatMessageTable 
} = createAllTables(backend.stack);

// Grant permissions to authenticated users for all tables
const authenticatedUserRole = backend.auth.resources.authenticatedUserIamRole;

// Grant permissions to all tables
projectTable.grantReadWriteData(authenticatedUserRole);
documentTable.grantReadWriteData(authenticatedUserRole);
userTable.grantReadWriteData(authenticatedUserRole);
documentTypeTable.grantReadWriteData(authenticatedUserRole);
domainTable.grantReadWriteData(authenticatedUserRole);
chatRoomTable.grantReadWriteData(authenticatedUserRole);
chatMessageTable.grantReadWriteData(authenticatedUserRole);

// Export table names for use in the frontend
backend.addOutput({
  custom: {
    projectTableName: projectTable.tableName,
    projectTableArn: projectTable.tableArn,
    documentTableName: documentTable.tableName,
    documentTableArn: documentTable.tableArn,
    userTableName: userTable.tableName,
    userTableArn: userTable.tableArn,
    documentTypeTableName: documentTypeTable.tableName,
    documentTypeTableArn: documentTypeTable.tableArn,
    domainTableName: domainTable.tableName,
    domainTableArn: domainTable.tableArn,
    chatRoomTableName: chatRoomTable.tableName,
    chatMessageTableName: chatMessageTable.tableName,
    chatRoomTableArn: chatRoomTable.tableArn,
    chatMessageTableArn: chatMessageTable.tableArn
  }
});