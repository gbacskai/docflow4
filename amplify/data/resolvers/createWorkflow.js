import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { arguments: args } = ctx;
  
  const id = util.autoId();
  const version = util.time.nowISO8601();
  
  const item = {
    ...args,
    id,
    version,
    active: true,
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
  return ctx.result;
}