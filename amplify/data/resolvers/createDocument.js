import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { arguments: args } = ctx;
  
  // Generate ID if not provided (for new documents) or use existing ID (for updates)
  const id = args.id || util.autoId();
  const version = util.time.nowISO8601();
  
  const item = {
    ...args,
    id,
    version,
    active: true, // Always create as active - Lambda will handle deactivating old versions
    createdAt: args.createdAt || version,
    updatedAt: version
  };
  
  return ddb.put({
    key: { id, version },
    item
  });
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  // The activeRecordProcessorFunction Lambda (via DynamoDB streams) will:
  // 1. Detect this new record with active=true
  // 2. Find any other records with the same ID that are also active=true  
  // 3. Mark the older versions as active=false
  // This maintains the "one active version per ID" constraint
  
  return ctx.result;
}