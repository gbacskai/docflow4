import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
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
    .authorization(allow => [
      allow.publicApiKey().to(['create', 'read', 'update', 'delete'])
    ]),
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
      emailVerified: a.boolean(), // Email verification status
      cognitoUserId: a.string(), // Cognito user ID for linking authenticated users
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
      // Primary key fields
      id: a.string().required(),
      version: a.datetime().required(),
      
      // Project/Document association
      projectId: a.string(),
      projectName: a.string(),
      documentId: a.string(),
      documentType: a.string(),
      roomType: a.enum(['project', 'document']),
      
      // Room details
      title: a.string().required(),
      description: a.string(),
      
      // Participants management
      participants: a.string().array(), // Combined list of all participants
      adminUsers: a.string().array(), // Project admins
      providerUsers: a.string().array(), // Document providers
      
      // Room status and metadata
      lastMessage: a.string(),
      lastMessageTime: a.datetime(),
      lastMessageSender: a.string(),
      messageCount: a.integer().default(0), // Total message count
      unreadCount: a.integer().default(0), // Unread messages count
      isActive: a.boolean().default(true),
      active: a.boolean().default(true),
      isArchived: a.boolean().default(false),
      
      // Room settings
      allowFileSharing: a.boolean().default(true),
      maxParticipants: a.integer().default(50),
      
      // Timestamps
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      lastActivityAt: a.datetime()
    })
    .identifier(['id', 'version'])
    .authorization(allow => [
      allow.publicApiKey().to(['create', 'read', 'update', 'delete']),
      allow.authenticated().to(['create', 'read', 'update', 'delete'])
    ]),
  ChatMessage: a.model({
      // Primary key fields
      id: a.string().required(),
      version: a.datetime().required(),
      
      // Reference to ChatRoom - this creates the relationship
      chatRoomId: a.string().required(),
      
      // Message sender information
      senderId: a.string().required(),
      senderName: a.string().required(),
      senderEmail: a.string(),
      senderType: a.enum(['admin', 'provider']),
      
      // Message content and metadata
      message: a.string().required(),
      messageType: a.enum(['text', 'system', 'file']),
      attachmentUrl: a.string(), // For file messages
      fileSize: a.integer(), // File size in bytes
      fileName: a.string(), // Original file name
      
      // Context references
      projectId: a.string(),
      documentId: a.string(),
      
      // Message status tracking
      isRead: a.boolean().default(false),
      readBy: a.string().array(), // Array of user IDs who have read this message
      readAt: a.datetime(), // When message was first read
      deliveredAt: a.datetime(), // When message was delivered
      
      // Message threading (for replies)
      replyToMessageId: a.string(),
      threadId: a.string(),
      
      // General status
      active: a.boolean().default(true),
      
      // Timestamps
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      editedAt: a.datetime() // If message was edited
    })
    .identifier(['id', 'version'])
    .authorization(allow => [
      allow.publicApiKey().to(['create', 'read', 'update', 'delete']),
      allow.authenticated().to(['create', 'read', 'update', 'delete'])
    ]),
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