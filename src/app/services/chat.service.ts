import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { UserDataService } from './user-data.service';
import { ChatMessage, ChatRoom } from '../chat/chat';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../../amplify/data/resource';

export interface SendMessageRequest {
  chatRoomId: string;
  message: string;
  senderType: 'admin' | 'provider';
}

export interface CreateChatRoomRequest {
  projectId?: string;
  projectName?: string;
  documentId?: string;
  documentType?: string;
  roomType: 'project' | 'document';
  title: string;
  description?: string;
  adminUsers?: string[];
  providerUsers?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private authService = inject(AuthService);
  private userDataService = inject(UserDataService);
  
  // Amplify Data client
  private client = generateClient<Schema>();
  
  // Event handlers for real-time updates
  private messageHandlers: ((message: ChatMessage) => void)[] = [];
  private roomUpdateHandlers: ((room: ChatRoom) => void)[] = [];
  
  // Connection state
  private isConnected = signal(false);
  
  // Subscriptions
  private messageSubscription: any = null;
  private roomSubscription: any = null;

  async connect(): Promise<void> {
    try {
      console.log('🔌 Connecting to chat service...');
      console.log('🔌 Current user data for subscriptions:', this.userDataService.getCurrentUserData());
      
      // Set up real-time subscriptions for new messages
      this.messageSubscription = this.client.models.ChatMessage.onCreate().subscribe({
        next: (data) => {
          console.log('📨 New message received via subscription:', data.senderName);
          const message = this.transformToLocalChatMessage(data);
          
          // Notify about all messages (including from current user for real-time sync)
          console.log('🔄 Notifying message handlers about new message');
          this.messageHandlers.forEach(handler => handler(message));
        },
        error: (error) => console.error('❌ Message subscription error:', error)
      });
      
      // Set up real-time subscriptions for room updates
      this.roomSubscription = this.client.models.ChatRoom.onUpdate().subscribe({
        next: (data) => {
          console.log('🏠 Chat room updated via subscription:', data.title);
          const room = this.transformToLocalChatRoom(data);
          this.roomUpdateHandlers.forEach(handler => handler(room));
        },
        error: (error) => console.error('❌ Room subscription error:', error)
      });
      
      this.isConnected.set(true);
      console.log('✅ Chat service connected with real-time subscriptions');
      
    } catch (error) {
      console.error('❌ Failed to connect to chat service:', error);
      throw error;
    }
  }

  disconnect(): void {
    // Unsubscribe from real-time subscriptions
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }
    
    if (this.roomSubscription) {
      this.roomSubscription.unsubscribe();
      this.roomSubscription = null;
    }
    
    this.messageHandlers = [];
    this.roomUpdateHandlers = [];
    this.isConnected.set(false);
    console.log('🔌 Chat service disconnected');
  }

  // Transform GraphQL ChatMessage to local ChatMessage interface
  private transformToLocalChatMessage(data: any): ChatMessage {
    return {
      id: data.id,
      chatRoomId: data.chatRoomId,
      senderId: data.senderId,
      senderName: data.senderName,
      senderEmail: data.senderEmail,
      senderType: data.senderType,
      message: data.message,
      messageType: data.messageType || 'text',
      attachmentUrl: data.attachmentUrl,
      fileSize: data.fileSize,
      fileName: data.fileName,
      timestamp: data.createdAt || data.timestamp,
      isRead: data.isRead || false,
      readBy: data.readBy || [],
      readAt: data.readAt,
      deliveredAt: data.deliveredAt,
      replyToMessageId: data.replyToMessageId,
      threadId: data.threadId,
      projectId: data.projectId,
      documentId: data.documentId,
      editedAt: data.editedAt
    };
  }

  // Transform GraphQL ChatRoom to local ChatRoom interface
  private transformToLocalChatRoom(data: any): ChatRoom {
    return {
      id: data.id,
      projectId: data.projectId,
      projectName: data.projectName || '',
      documentId: data.documentId,
      documentType: data.documentType,
      roomType: data.roomType,
      title: data.title,
      description: data.description,
      participants: data.participants || [],
      adminUsers: data.adminUsers,
      providerUsers: data.providerUsers,
      lastMessage: data.lastMessage,
      lastMessageTime: data.lastMessageTime,
      lastMessageSender: data.lastMessageSender,
      messageCount: data.messageCount || 0,
      unreadCount: data.unreadCount || 0,
      isActive: data.isActive !== false,
      isArchived: data.isArchived || false,
      allowFileSharing: data.allowFileSharing !== false,
      maxParticipants: data.maxParticipants,
      lastActivityAt: data.lastActivityAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  async getChatRooms(): Promise<ChatRoom[]> {
    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const currentUserData = this.userDataService.getCurrentUserData();
      if (!currentUserData) {
        throw new Error('User data not available');
      }

      console.log('📋 Fetching chat rooms for user:', currentUserData.id);
      console.log('📋 Full current user data object:', currentUserData);
      
      // Query ChatRoom using Amplify Data
      const { data: rooms } = await this.client.models.ChatRoom.list();
      console.log('📋 Raw rooms from Amplify:', rooms);
      console.log('📋 Number of raw rooms:', rooms.length);
      
      // Filter rooms where current user is a participant (using database User ID)
      const userRooms = rooms.filter(room => {
        const isParticipant = room.participants && room.participants.includes(currentUserData.id);
        console.log(`📋 Room ${room.title}: participants=${room.participants}, isParticipant=${isParticipant}`);
        return isParticipant;
      });
      
      console.log('📋 User rooms after filtering:', userRooms.length);
      
      const transformedRooms = userRooms.map(room => this.transformToLocalChatRoom(room));
      
      console.log('✅ Fetched chat rooms from Amplify Data:', transformedRooms.length);
      console.log('✅ Room IDs:', transformedRooms.map(r => r.id));
      return transformedRooms;
      
    } catch (error) {
      console.error('❌ Error fetching chat rooms:', error);
      // Fallback to mock data for development
      const currentUserData = this.userDataService.getCurrentUserData();
      if (!currentUserData) {
        throw error;
      }
      
      const mockRooms: ChatRoom[] = [
        {
          id: 'room-project-1',
          projectId: 'project-1',
          projectName: 'Website Redesign Project',
          roomType: 'project',
          title: 'Website Redesign Project Chat',
          description: 'Main discussion room for the website redesign project',
          participants: [currentUserData.id, 'admin-1', 'provider-1'],
          adminUsers: ['admin-1'],
          providerUsers: ['provider-1'],
          lastMessage: 'The design mockups are ready for review. Please check them out!',
          lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
          lastMessageSender: 'Design Team',
          messageCount: 15,
          unreadCount: 2,
          isActive: true,
          allowFileSharing: true,
          lastActivityAt: new Date(Date.now() - 3600000).toISOString()
        }
      ];

      console.log('✅ Using fallback mock chat rooms:', mockRooms.length);
      return mockRooms;
    }
  }

  async getMessages(chatRoomId: string): Promise<ChatMessage[]> {
    try {
      console.log('📨 Fetching messages for room:', chatRoomId);
      console.log('📨 Is connected:', this.isConnected());
      
      // Query ChatMessage using Amplify Data filtered by chatRoomId
      const { data: messages } = await this.client.models.ChatMessage.list({
        filter: {
          chatRoomId: {
            eq: chatRoomId
          }
        }
      });
      
      // Sort messages by timestamp (oldest first)
      const sortedMessages = messages.sort((a, b) => {
        const timeA = new Date(a.createdAt || '').getTime();
        const timeB = new Date(b.createdAt || '').getTime();
        return timeA - timeB;
      });
      
      const transformedMessages = sortedMessages.map(message => this.transformToLocalChatMessage(message));
      
      console.log('✅ Fetched messages from Amplify Data:', transformedMessages.length);
      return transformedMessages;
      
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      // Fallback to mock data for development
      const mockMessages: ChatMessage[] = [
        {
          id: `${chatRoomId}-msg-1`,
          chatRoomId,
          senderId: 'admin-1',
          senderName: 'Project Admin',
          senderType: 'admin',
          message: 'Welcome to the chat room!',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          isRead: true,
          projectId: 'project-1'
        }
      ];
        
      console.log('✅ Using fallback mock messages:', mockMessages.length);
      return mockMessages;
    }
  }

  async sendMessage(request: SendMessageRequest): Promise<ChatMessage> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const currentUserData = this.userDataService.getCurrentUserData();
    if (!currentUserData) {
      throw new Error('User data not available');
    }

    console.log('📤 Sending message:', { 
      room: request.chatRoomId, 
      message: request.message.substring(0, 50) + '...' 
    });

    try {
      // Create message using Amplify Data (using database User ID)
      console.log('📤 Creating message with data:', {
        chatRoomId: request.chatRoomId,
        senderId: currentUserData.id,
        senderName: currentUserData.firstName && currentUserData.lastName 
          ? `${currentUserData.firstName} ${currentUserData.lastName}` 
          : currentUserData.email || 'Unknown User',
        senderType: request.senderType,
        messageType: 'text'
      });
      
      const { data: newMessage } = await this.client.models.ChatMessage.create({
        chatRoomId: request.chatRoomId,
        senderId: currentUserData.id,
        senderName: currentUserData.firstName && currentUserData.lastName 
          ? `${currentUserData.firstName} ${currentUserData.lastName}` 
          : currentUserData.email || 'Unknown User',
        senderType: request.senderType,
        message: request.message,
        messageType: 'text',
        isRead: false
      });

      console.log('✅ Message created with Amplify Data successfully');
      console.log('✅ Created message data:', newMessage);

      if (!newMessage) {
        throw new Error('Failed to create message');
      }

      // Transform to local ChatMessage format
      const transformedMessage = this.transformToLocalChatMessage(newMessage);

      // Update chat room's last message
      await this.updateRoomLastMessage(request.chatRoomId, transformedMessage);

      console.log('✅ Message sent with Amplify Data successfully');
      return transformedMessage;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  async markMessagesAsRead(chatRoomId: string): Promise<void> {
    try {
      console.log('📖 Marking messages as read for room:', chatRoomId);
      
      const currentUserData = this.userDataService.getCurrentUserData();
      if (!currentUserData) return;

      console.log('📖 Messages marked as read (implementation pending)');
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      throw error;
    }
  }

  private async updateRoomLastMessage(chatRoomId: string, message: ChatMessage): Promise<void> {
    try {
      await this.client.models.ChatRoom.update({
        id: chatRoomId,
        lastMessage: message.message,
        lastMessageTime: message.timestamp,
        lastMessageSender: message.senderName,
        lastActivityAt: new Date().toISOString()
      });
      console.log('✅ Updated room last message with Amplify Data');
    } catch (error) {
      console.error('❌ Error updating room last message:', error);
    }
  }

  onNewMessage(handler: (message: ChatMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onRoomUpdate(handler: (room: ChatRoom) => void): void {
    this.roomUpdateHandlers.push(handler);
  }

  // Find existing chat room by project ID
  async findExistingProjectChatRoom(projectId: string): Promise<ChatRoom | null> {
    try {
      console.log('🔍 Searching for existing chat room for project:', projectId);
      
      const { data: rooms } = await this.client.models.ChatRoom.list({
        filter: {
          projectId: {
            eq: projectId
          },
          roomType: {
            eq: 'project'
          }
        }
      });

      console.log('🔍 Found existing rooms for project:', rooms.length);
      
      if (rooms.length > 0) {
        const room = this.transformToLocalChatRoom(rooms[0]);
        console.log('✅ Found existing project chat room:', room.id);
        return room;
      }

      console.log('ℹ️ No existing chat room found for project');
      return null;
    } catch (error) {
      console.error('❌ Error searching for existing chat room:', error);
      return null;
    }
  }

  // Find existing chat room by document ID
  async findExistingDocumentChatRoom(documentId: string): Promise<ChatRoom | null> {
    try {
      console.log('🔍 Searching for existing chat room for document:', documentId);
      
      const { data: rooms } = await this.client.models.ChatRoom.list({
        filter: {
          documentId: {
            eq: documentId
          },
          roomType: {
            eq: 'document'
          }
        }
      });

      console.log('🔍 Found existing rooms for document:', rooms.length);
      
      if (rooms.length > 0) {
        const room = this.transformToLocalChatRoom(rooms[0]);
        console.log('✅ Found existing document chat room:', room.id);
        return room;
      }

      console.log('ℹ️ No existing chat room found for document');
      return null;
    } catch (error) {
      console.error('❌ Error searching for existing document chat room:', error);
      return null;
    }
  }

  // Ensure current user is a participant in an existing chat room
  async ensureUserInChatRoom(chatRoom: ChatRoom, participants: string[]): Promise<ChatRoom> {
    try {
      const currentUserData = this.userDataService.getCurrentUserData();
      if (!currentUserData) {
        return chatRoom;
      }

      // Check if current user is already a participant
      if (chatRoom.participants.includes(currentUserData.id)) {
        console.log('✅ Current user is already a participant in chat room');
        return chatRoom;
      }

      console.log('➕ Adding current user to existing chat room participants');
      
      // Update the chat room with new participants list
      const updatedParticipants = [...new Set([...chatRoom.participants, currentUserData.id])];
      
      await this.client.models.ChatRoom.update({
        id: chatRoom.id,
        participants: updatedParticipants,
        adminUsers: participants.filter(p => p !== null), // Update admin users as well
        lastActivityAt: new Date().toISOString()
      });

      // Return updated room
      const updatedRoom = { ...chatRoom, participants: updatedParticipants };
      console.log('✅ Updated chat room participants');
      return updatedRoom;
      
    } catch (error) {
      console.error('❌ Error updating chat room participants:', error);
      return chatRoom; // Return original room if update fails
    }
  }

  // Create chat room for a project (adds all admins)
  async createProjectChatRoom(request: CreateChatRoomRequest): Promise<ChatRoom> {
    try {
      console.log('🆕 Creating project chat room:', request.title);

      const now = new Date().toISOString();
      
      // Create room using Amplify Data
      const { data: newRoom } = await this.client.models.ChatRoom.create({
        projectId: request.projectId,
        projectName: request.projectName || request.title,
        roomType: 'project',
        title: request.title,
        description: request.description,
        participants: [...(request.adminUsers || []), ...(request.providerUsers || [])],
        adminUsers: request.adminUsers,
        providerUsers: request.providerUsers,
        lastMessage: `Welcome to ${request.title}!`,
        lastMessageTime: now,
        lastMessageSender: 'System',
        messageCount: 0,
        unreadCount: 0,
        isActive: true,
        allowFileSharing: true,
        lastActivityAt: now
      });

      if (!newRoom) {
        throw new Error('Failed to create chat room');
      }

      const transformedRoom = this.transformToLocalChatRoom(newRoom);

      console.log('✅ Project chat room created with Amplify Data successfully');
      return transformedRoom;
    } catch (error) {
      console.error('❌ Error creating project chat room:', error);
      throw error;
    }
  }

  // Create chat room for a document (adds assigned providers)
  async createDocumentChatRoom(request: CreateChatRoomRequest): Promise<ChatRoom> {
    try {
      console.log('🆕 Creating document chat room:', request.title);

      const now = new Date().toISOString();
      
      // Create room using Amplify Data
      const { data: newRoom } = await this.client.models.ChatRoom.create({
        projectId: request.projectId,
        documentId: request.documentId,
        documentType: request.documentType,
        projectName: request.projectName || `${request.documentType} - ${request.title}`,
        roomType: 'document',
        title: request.title,
        description: request.description,
        participants: [...(request.adminUsers || []), ...(request.providerUsers || [])],
        adminUsers: request.adminUsers,
        providerUsers: request.providerUsers,
        lastMessage: `Welcome to the ${request.documentType} document chat!`,
        lastMessageTime: now,
        lastMessageSender: 'System',
        messageCount: 0,
        unreadCount: 0,
        isActive: true,
        allowFileSharing: true,
        lastActivityAt: now
      });

      if (!newRoom) {
        throw new Error('Failed to create document chat room');
      }

      const transformedRoom = this.transformToLocalChatRoom(newRoom);

      console.log('✅ Document chat room created with Amplify Data successfully');
      return transformedRoom;
    } catch (error) {
      console.error('❌ Error creating document chat room:', error);
      throw error;
    }
  }
}