import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

// Minimal schema to prevent TypeScript errors
// We'll configure table names through environment variables
const schema = a.schema({
  Todo: a.model({
    content: a.string()
  }).authorization(allow => [allow.publicApiKey()])
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 30 }
  },
  name: `docflow4-${process.env['ENV'] || process.env['AMPLIFY_BRANCH'] || 'dev'}`
});