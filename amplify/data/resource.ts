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
      identifier: a.string(),
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
    .authorization(allow => [allow.publicApiKey()]),
  ChatRoom: a.model({
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
      isArchived: a.boolean().default(false),
      
      // Room settings
      allowFileSharing: a.boolean().default(true),
      maxParticipants: a.integer().default(50),
      
      // Timestamps
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      lastActivityAt: a.datetime(),
      
      // Relationship to messages
      messages: a.hasMany('ChatMessage', 'chatRoomId')
    })
    .authorization(allow => [
      allow.publicApiKey(),
      allow.authenticated()
    ]),
  ChatMessage: a.model({
      // Reference to ChatRoom - this creates the relationship
      chatRoomId: a.string().required(),
      chatRoom: a.belongsTo('ChatRoom', 'chatRoomId'),
      
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
      
      // Timestamps
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      editedAt: a.datetime() // If message was edited
    })
    .authorization(allow => [
      allow.publicApiKey(),
      allow.authenticated()
    ])
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