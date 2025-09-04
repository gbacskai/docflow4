import { defineFunction } from '@aws-amplify/backend';

export const deleteAllCognitoUsersFunction = defineFunction({
  entry: './handler.ts',
  timeoutSeconds: 300,
  environment: {
    // User Pool ID will be provided by backend configuration
  }
});