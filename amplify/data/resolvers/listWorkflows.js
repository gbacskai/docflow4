import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
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
  
  // Deduplicate by ID, keeping latest version
  const itemMap = {};
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const existingItem = itemMap[item.id];
    if (!existingItem || new Date(item.version) > new Date(existingItem.version)) {
      itemMap[item.id] = item;
    }
  }
  
  // Convert object values to array
  const result = [];
  for (const key in itemMap) {
    if (itemMap.hasOwnProperty(key)) {
      result.push(itemMap[key]);
    }
  }
  
  return result;
}