import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { arguments: args } = ctx;
  const { id, ...updateData } = args;
  
  if (!id) {
    util.error('User ID is required for update', 'ValidationException');
  }
  
  // Generate new version
  const version = util.time.nowISO8601();
  
  // First, get the current record to preserve existing data
  return ddb.query({
    query: {
      expression: 'id = :id AND active = :active',
      expressionValues: {
        ':id': id,
        ':active': true
      }
    },
    scanIndexForward: false,
    limit: 1
  });
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  const existingItems = ctx.result.items;
  if (!existingItems || existingItems.length === 0) {
    util.error('User not found', 'NotFound');
  }
  
  const existingItem = existingItems[0];
  const { arguments: args } = ctx.stash;
  const { id, ...updateData } = args;
  const version = util.time.nowISO8601();
  
  // Mark old version as inactive
  const deactivateOld = ddb.update({
    key: { id: existingItem.id, version: existingItem.version },
    update: {
      expression: 'SET active = :active',
      expressionValues: {
        ':active': false
      }
    }
  });
  
  // Create new version with updated data
  const newItem = {
    ...existingItem,
    ...updateData,
    id,
    version,
    active: true,
    updatedAt: version
  };
  
  const createNew = ddb.put({
    key: { id, version },
    item: newItem
  });
  
  // Return the new item (we'll need to handle the transaction in a more complex way)
  return newItem;
}