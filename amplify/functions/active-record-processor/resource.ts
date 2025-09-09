import { defineFunction } from '@aws-amplify/backend';

export const activeRecordProcessorFunction = defineFunction({
  name: 'active-record-processor',
  entry: './handler.ts',
  timeoutSeconds: 60,
  environment: {
    // Environment variables will be automatically available
  }
});