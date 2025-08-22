import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  Project: a.model({
      name: a.string().required(),
      description: a.string().required(),
      defaultDomain: a.string().required(),
      ownerId: a.string().required(),
      adminUsers: a.string().array(),
      status: a.enum(['active', 'completed', 'archived']),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization(allow => [allow.publicApiKey()]),
  Document: a.model({
      projectId: a.string().required(),
      documentType: a.string().required(),
      assignedProviders: a.string().array(),
      acceptedProvider: a.string(),
      status: a.enum(['requested', 'accepted', 'rejected', 'provided']),
      dueDate: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization(allow => [allow.publicApiKey()]),
  User: a.model({
      email: a.string().required(),
      userType: a.enum(['admin', 'client']),
      firstName: a.string().required(),
      lastName: a.string().required(),
      interestedDocumentTypes: a.string().array(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization(allow => [allow.publicApiKey()])
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 30 }
  }
});