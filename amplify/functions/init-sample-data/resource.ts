import { defineFunction } from '@aws-amplify/backend';

export const initSampleDataFunction = defineFunction({
  entry: './handler.ts',
  timeoutSeconds: 60,
  environment: {
    // Environment variables will be automatically available
  }
});