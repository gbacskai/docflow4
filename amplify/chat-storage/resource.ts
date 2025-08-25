import { defineFunction } from '@aws-amplify/backend';

export const chatStorage = defineFunction({
  name: 'chat-storage',
  entry: './handler.ts'
});