import { defineFunction } from '@aws-amplify/backend';

export const chatStreamHandler = defineFunction({
  name: 'chat-stream-handler',
  entry: './handler.ts'
});