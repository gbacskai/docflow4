import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

// Define custom types that match our DynamoDB table structure
const schema = a.schema({
  // Custom types for external DynamoDB tables
  ExternalProject: a.customType({
    id: a.string().required(),
    version: a.datetime().required(),
    name: a.string().required(),
    identifier: a.string(),
    description: a.string().required(),
    ownerId: a.string().required(),
    adminUsers: a.string().array(),
    workflowId: a.string(),
    status: a.string(),
    active: a.boolean(),
    createdAt: a.datetime(),
    updatedAt: a.datetime()
  }),
  
  ExternalUser: a.customType({
    id: a.string().required(),
    version: a.datetime().required(),
    email: a.string().required(),
    userType: a.string(),
    firstName: a.string(),
    lastName: a.string(),
    interestedDocumentTypes: a.string().array(),
    status: a.string(),
    emailVerified: a.boolean(),
    cognitoUserId: a.string(),
    invitedBy: a.string(),
    createdBy: a.string(),
    invitedAt: a.datetime(),
    lastLoginAt: a.datetime(),
    active: a.boolean(),
    createdAt: a.datetime(),
    updatedAt: a.datetime()
  }),
  
  ExternalDocument: a.customType({
    id: a.string().required(),
    version: a.datetime().required(),
    projectId: a.string().required(),
    documentType: a.string().required(),
    formData: a.string(),
    active: a.boolean(),
    createdAt: a.datetime(),
    updatedAt: a.datetime()
  }),
  
  ExternalDocumentType: a.customType({
    id: a.string().required(),
    version: a.datetime().required(),
    name: a.string().required(),
    identifier: a.string(),
    description: a.string(),
    definition: a.string().required(),
    validationRules: a.string(),
    category: a.string(),
    fields: a.string().array(),
    isActive: a.boolean(),
    active: a.boolean(),
    usageCount: a.integer(),
    templateCount: a.integer(),
    createdAt: a.datetime(),
    updatedAt: a.datetime()
  }),
  
  ExternalWorkflow: a.customType({
    id: a.string().required(),
    version: a.datetime().required(),
    name: a.string().required(),
    identifier: a.string(),
    description: a.string(),
    rules: a.json().array(),
    actors: a.string().array(),
    isActive: a.boolean(),
    active: a.boolean(),
    createdAt: a.datetime(),
    updatedAt: a.datetime()
  }),
  
  ExternalChatRoom: a.customType({
    id: a.string().required(),
    version: a.datetime().required(),
    projectId: a.string(),
    projectName: a.string(),
    documentId: a.string(),
    documentType: a.string(),
    roomType: a.string(),
    title: a.string().required(),
    description: a.string(),
    participants: a.string().array(),
    adminUsers: a.string().array(),
    providerUsers: a.string().array(),
    lastMessage: a.string(),
    lastMessageTime: a.datetime(),
    lastMessageSender: a.string(),
    messageCount: a.integer(),
    unreadCount: a.integer(),
    isActive: a.boolean(),
    active: a.boolean(),
    isArchived: a.boolean(),
    allowFileSharing: a.boolean(),
    maxParticipants: a.integer(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    lastActivityAt: a.datetime()
  }),
  
  ExternalChatMessage: a.customType({
    id: a.string().required(),
    version: a.datetime().required(),
    chatRoomId: a.string().required(),
    senderId: a.string().required(),
    senderName: a.string().required(),
    senderEmail: a.string(),
    senderType: a.string(),
    message: a.string().required(),
    messageType: a.string(),
    attachmentUrl: a.string(),
    fileSize: a.integer(),
    fileName: a.string(),
    projectId: a.string(),
    documentId: a.string(),
    isRead: a.boolean(),
    readBy: a.string().array(),
    readAt: a.datetime(),
    deliveredAt: a.datetime(),
    replyToMessageId: a.string(),
    threadId: a.string(),
    active: a.boolean(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    editedAt: a.datetime()
  }),
  
  // Temporarily disable external operations to fix deployment
  // TODO: Re-enable external operations once resolver issues are resolved

  // Model definitions - resolvers will be redirected in backend.ts
  Project: a.model({
      id: a.string().required(),
      version: a.datetime().required(),
      name: a.string().required(),
      identifier: a.string(),
      description: a.string().required(),
      ownerId: a.string().required(),
      adminUsers: a.string().array(),
      workflowId: a.string(),
      status: a.enum(['active', 'completed', 'archived']),
      active: a.boolean().default(true),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .identifier(['id', 'version'])
    .authorization(allow => [allow.publicApiKey().to(['create', 'read', 'update', 'delete'])]),

  Document: a.model({
      id: a.string().required(),
      version: a.datetime().required(),
      projectId: a.string().required(),
      documentType: a.string().required(),
      formData: a.string(),
      active: a.boolean().default(true),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .identifier(['id', 'version'])
    .authorization(allow => [allow.publicApiKey().to(['create', 'read', 'update', 'delete'])]),

  User: a.model({
      id: a.string().required(),
      version: a.datetime().required(),
      email: a.string().required(),
      userType: a.enum(['admin', 'client', 'provider']),
      firstName: a.string(),
      lastName: a.string(),
      interestedDocumentTypes: a.string().array(),
      status: a.enum(['invited', 'active', 'inactive', 'archived']),
      emailVerified: a.boolean(),
      cognitoUserId: a.string(),
      invitedBy: a.string(),
      createdBy: a.string(),
      invitedAt: a.datetime(),
      lastLoginAt: a.datetime(),
      active: a.boolean().default(true),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .identifier(['id', 'version'])
    .authorization(allow => [allow.publicApiKey().to(['create', 'read', 'update', 'delete'])]),

  DocumentType: a.model({
      id: a.string().required(),
      version: a.datetime().required(),
      name: a.string().required(),
      identifier: a.string(),
      description: a.string(),
      definition: a.string().required(),
      validationRules: a.string(),
      category: a.string(),
      fields: a.string().array(),
      isActive: a.boolean(),
      active: a.boolean().default(true),
      usageCount: a.integer(),
      templateCount: a.integer(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .identifier(['id', 'version'])
    .authorization(allow => [allow.publicApiKey().to(['create', 'read', 'update', 'delete'])]),

  Workflow: a.model({
      id: a.string().required(),
      version: a.datetime().required(),
      name: a.string().required(),
      identifier: a.string(),
      description: a.string(),
      rules: a.json().array(),
      actors: a.string().array(),
      isActive: a.boolean().default(true),
      active: a.boolean().default(true),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .identifier(['id', 'version'])
    .authorization(allow => [allow.publicApiKey().to(['create', 'read', 'update', 'delete'])]),

  ChatRoom: a.model({
      id: a.string().required(),
      version: a.datetime().required(),
      projectId: a.string(),
      projectName: a.string(),
      documentId: a.string(),
      documentType: a.string(),
      roomType: a.enum(['project', 'document']),
      title: a.string().required(),
      description: a.string(),
      participants: a.string().array(),
      adminUsers: a.string().array(),
      providerUsers: a.string().array(),
      lastMessage: a.string(),
      lastMessageTime: a.datetime(),
      lastMessageSender: a.string(),
      messageCount: a.integer().default(0),
      unreadCount: a.integer().default(0),
      isActive: a.boolean().default(true),
      active: a.boolean().default(true),
      isArchived: a.boolean().default(false),
      allowFileSharing: a.boolean().default(true),
      maxParticipants: a.integer().default(50),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      lastActivityAt: a.datetime()
    })
    .identifier(['id', 'version'])
    .authorization(allow => [allow.publicApiKey().to(['create', 'read', 'update', 'delete'])]),

  ChatMessage: a.model({
      id: a.string().required(),
      version: a.datetime().required(),
      chatRoomId: a.string().required(),
      senderId: a.string().required(),
      senderName: a.string().required(),
      senderEmail: a.string(),
      senderType: a.enum(['admin', 'provider']),
      message: a.string().required(),
      messageType: a.enum(['text', 'system', 'file']),
      attachmentUrl: a.string(),
      fileSize: a.integer(),
      fileName: a.string(),
      projectId: a.string(),
      documentId: a.string(),
      isRead: a.boolean().default(false),
      readBy: a.string().array(),
      readAt: a.datetime(),
      deliveredAt: a.datetime(),
      replyToMessageId: a.string(),
      threadId: a.string(),
      active: a.boolean().default(true),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      editedAt: a.datetime()
    })
    .identifier(['id', 'version'])
    .authorization(allow => [allow.publicApiKey().to(['create', 'read', 'update', 'delete'])]),


  // AI-powered workflow validation
  validateWorkflow: a.generation({
    aiModel: a.ai.model('Claude 3 Sonnet'),
    systemPrompt: 'You are a workflow creator. You create workflows based on user requirements. You only return the workflow in valid json',
  })
  .arguments({
    definition: a.string(),
  })
  .returns(
    a.customType({
      workflow: a.string(),
    })
  )
  .authorization((allow) => allow.publicApiKey()),

  // Email duplication check - temporarily disabled
  // checkEmailDuplicate: a.query()
  //   .arguments({
  //     email: a.string().required()
  //   })
  //   .returns(
  //     a.customType({
  //       isDuplicate: a.boolean(),
  //       message: a.string(),
  //       existingUserId: a.string()
  //     })
  //   )
  //   .handler(a.handler.function('checkEmailDuplicateFunction'))
  //   .authorization((allow) => allow.publicApiKey()),

  // Delete all Cognito users (admin function) - temporarily disabled
  // deleteAllCognitoUsers: a.query()
  //   .arguments({
  //     confirmDeletion: a.boolean().required()
  //   })
  //   .returns(
  //     a.customType({
  //       success: a.boolean(),
  //       deletedCount: a.integer(),
  //       error: a.string()
  //     })
  //   )
  //   .handler(a.handler.function('deleteAllCognitoUsersFunction'))
  //   .authorization((allow) => allow.publicApiKey()),
    
  // Custom query to initialize sample data will be added via backend.ts
    
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 30 }
  }
});