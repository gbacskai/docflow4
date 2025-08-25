import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
// TODO: Re-enable stream handler once CDK integration is resolved
// import { chatStreamHandler } from './functions/chat-stream-handler/resource';
import { createChatTables } from './custom-resources/chat-tables';

const backend = defineBackend({
  auth,
  data,
  storage
  // TODO: Re-enable stream handler
  // chatStreamHandler
});

// Add custom DynamoDB tables for chat functionality
// TODO: Re-enable stream handler once CDK integration is resolved
const { chatRoomTable, chatMessageTable } = createChatTables(backend.stack);

// Grant permissions to authenticated users for chat tables
const authenticatedUserRole = backend.auth.resources.authenticatedUserIamRole;

// Grant permissions to chat tables
chatRoomTable.grantReadWriteData(authenticatedUserRole);
chatMessageTable.grantReadWriteData(authenticatedUserRole);

// Export table names for use in the frontend
backend.addOutput({
  custom: {
    chatRoomTableName: chatRoomTable.tableName,
    chatMessageTableName: chatMessageTable.tableName,
    chatRoomTableArn: chatRoomTable.tableArn,
    chatMessageTableArn: chatMessageTable.tableArn
  }
});