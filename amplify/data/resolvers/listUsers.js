import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  // Scan for all active users
  return ddb.scan({
    filter: {
      expression: 'active = :active',
      expressionValues: {
        ':active': true
      }
    }
  });
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  const items = ctx.result.items || [];
  
  // Group by ID and keep only the latest version of each user
  const userMap = {};
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const existingUser = userMap[item.id];
    if (!existingUser || new Date(item.version) > new Date(existingUser.version)) {
      userMap[item.id] = item;
    }
  }
  
  // Convert object values to array
  const result = [];
  for (const key in userMap) {
    if (userMap.hasOwnProperty(key)) {
      result.push(userMap[key]);
    }
  }
  
  return result;
}