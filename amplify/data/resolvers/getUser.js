import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { id } = ctx.arguments;
  
  if (!id) {
    util.error('User ID is required', 'ValidationException');
  }
  
  // Query for active version of the user
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
  
  const items = ctx.result.items;
  
  if (!items || items.length === 0) {
    return null;
  }
  
  return items[0];
}