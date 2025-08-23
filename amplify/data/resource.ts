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
    .authorization(allow => [
      allow.publicApiKey().to(['create', 'read', 'update'])
    ]),
  Document: a.model({
      projectId: a.string().required(),
      documentType: a.string().required(),
      assignedProviders: a.string().array(),
      acceptedProvider: a.string(),
      status: a.enum(['requested', 'accepted', 'rejected', 'provided', 'amended']),
      dueDate: a.datetime(),
      fileUrls: a.string().array(),
      fileNames: a.string().array(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization(allow => [allow.publicApiKey()]),
  User: a.model({
      email: a.string().required(),
      userType: a.enum(['admin', 'client', 'provider']),
      firstName: a.string(),
      lastName: a.string(),
      interestedDocumentTypes: a.string().array(),
      status: a.enum(['invited', 'active', 'inactive', 'archived']),
      cognitoUserId: a.string(), // Cognito user ID for linking authenticated users
      invitedBy: a.string(),
      invitedAt: a.datetime(),
      lastLoginAt: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization(allow => [allow.publicApiKey()]),
  DocumentType: a.model({
      name: a.string().required(),
      description: a.string().required(),
      category: a.string(),
      fields: a.string().array(),
      domainIds: a.string().array(),
      isActive: a.boolean(),
      usageCount: a.integer(),
      templateCount: a.integer(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization(allow => [allow.publicApiKey()]),
  Domain: a.model({
      name: a.string().required(),
      description: a.string().required(),
      status: a.enum(['active', 'archived']),
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