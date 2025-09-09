import { defineFunction } from '@aws-amplify/backend';

export const checkEmailDuplicateFunction = defineFunction({
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    // Table name will be provided by backend configuration
  }
});