import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserDataService } from '../services/user-data.service';
import { ChatService } from '../services/chat.service';

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderType: 'admin' | 'provider';
  message: string;
  messageType?: 'text' | 'system' | 'file';
  attachmentUrl?: string;
  fileSize?: number;
  fileName?: string;
  timestamp: string;
  isRead: boolean;
  readBy?: string[];
  readAt?: string;
  deliveredAt?: string;
  replyToMessageId?: string;
  threadId?: string;
  projectId?: string;
  documentId?: string;
  active?: boolean;
  editedAt?: string;
}

export interface ChatRoom {
  id: string;
  projectId?: string;
  projectName: string;
  documentId?: string;
  documentType?: string;
  roomType: 'project' | 'document';
  title: string;
  description?: string;
  participants: string[];
  adminUsers?: string[];
  providerUsers?: string[];
  messageCount?: number;
  unreadCount: number;
  isActive: boolean;
  active?: boolean;
  isArchived?: boolean;
  allowFileSharing?: boolean;
  maxParticipants?: number;
  lastActivityAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.less'
})
export class Chat implements OnInit, OnDestroy, AfterViewChecked {
  private authService = inject(AuthService);
  private userDataService = inject(UserDataService);
  private chatService = inject(ChatService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @ViewChild('chatMessages') chatMessagesContainer!: ElementRef;

  // Signals for reactive state
  chatRooms = signal<ChatRoom[]>([]);
  selectedRoom = signal<ChatRoom | null>(null);
  messages = signal<ChatMessage[]>([]);
  loading = signal(false);
  connecting = signal(true);
  
  // Form data
  newMessage = signal('');
  
  // User data
  currentUser = this.authService.currentUser;
  isAdmin = signal(false);
  
  // UI State
  showRightSidebar = signal(true);
  showBackButton = signal(false);
  backButtonText = signal('Back');
  backRoute = signal('/projects');
  
  private scrollToBottom = false;

  async ngOnInit() {
    this.checkUserRole();
    
    // Wait for user data to be available before proceeding
    await this.waitForUserData();
    
    await this.initializeRealtimeConnection();
    await this.loadChatRooms();
    
    // Check for query parameters
    this.route.queryParams.subscribe(async params => {
      console.log('📨 Chat component received query params:', params);
      
      if (params['room']) {
        console.log('🎯 Attempting to select room:', params['room']);
        this.selectRoomById(params['room']);
      }
      
      // Handle project-based navigation from reporting page
      if (params['projectId'] && params['projectName']) {
        console.log('🏢 Attempting to find/create project chat room:', params['projectName']);
        await this.findOrCreateProjectChatRoom(params['projectId'], params['projectName']);
      }
      
      if (params['from']) {
        console.log('⬅️ Setting up back button for source:', params['from']);
        this.showBackButton.set(true);
        switch (params['from']) {
          case 'projects':
            this.backRoute.set('/projects');
            this.backButtonText.set('Back to Projects');
            break;
          case 'documents':
            this.backRoute.set('/documents');
            this.backButtonText.set('Back to Documents');
            break;
          case 'reporting':
            this.backRoute.set('/reporting');
            this.backButtonText.set('Back to Reporting');
            break;
          default:
            this.backRoute.set('/dashboard');
            this.backButtonText.set('Back to Dashboard');
        }
      }
    });
  }

  ngOnDestroy() {
    // Clean up real-time connections
    this.chatService.disconnect();
  }

  ngAfterViewChecked() {
    if (this.scrollToBottom) {
      this.scrollChatToBottom();
      this.scrollToBottom = false;
    }
  }

  private async waitForUserData(): Promise<void> {
    // Wait for user data to be loaded
    while (this.userDataService.loading() || !this.userDataService.getCurrentUserData()) {
      console.log('⏳ Waiting for user data to be available...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('✅ User data is now available');
  }

  private checkUserRole() {
    // Check if current user is admin or provider
    const user = this.currentUser();
    if (user) {
      // This would need to be determined from user data/roles
      this.isAdmin.set(user.email?.includes('admin') || false);
    }
  }

  private async loadChatRooms() {
    this.loading.set(true);
    try {
      const rooms = await this.chatService.getChatRooms();
      this.chatRooms.set(rooms);
      
      // Select first room if available
      if (rooms.length > 0 && !this.selectedRoom()) {
        this.selectRoom(rooms[0]);
      }
    } catch (error) {
      console.error('Error loading chat rooms:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async initializeRealtimeConnection() {
    this.connecting.set(true);
    try {
      await this.chatService.connect();
      
      // Subscribe to new messages
      this.chatService.onNewMessage((message: ChatMessage) => {
        const currentMessages = this.messages();
        
        // Check if message already exists to prevent duplicates
        const messageExists = currentMessages.some(m => m.id === message.id);
        if (!messageExists) {
          console.log('➕ Adding new message to chat:', message.message.substring(0, 30) + '...');
          this.messages.set([...currentMessages, message]);
          this.scrollToBottom = true;
        } else {
          console.log('🔄 Message already exists, skipping duplicate:', message.id);
        }
      });
      
      // Subscribe to room updates
      this.chatService.onRoomUpdate((room: ChatRoom) => {
        const rooms = this.chatRooms();
        const updatedRooms = rooms.map(r => r.id === room.id ? room : r);
        this.chatRooms.set(updatedRooms);
      });
      
    } catch (error) {
      console.error('Error connecting to chat service:', error);
    } finally {
      this.connecting.set(false);
    }
  }

  async selectRoom(room: ChatRoom) {
    if (this.selectedRoom()?.id === room.id) return;
    
    this.selectedRoom.set(room);
    this.loading.set(true);
    
    try {
      const messages = await this.chatService.getMessages(room.id);
      this.messages.set(messages);
      this.scrollToBottom = true;
      
      // Mark messages as read
      await this.chatService.markMessagesAsRead(room.id);
      
      // Update room unread count
      room.unreadCount = 0;
      const rooms = this.chatRooms();
      const updatedRooms = rooms.map(r => r.id === room.id ? room : r);
      this.chatRooms.set(updatedRooms);
      
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async sendMessage() {
    const messageText = this.newMessage().trim();
    const room = this.selectedRoom();
    
    if (!messageText || !room) return;
    
    try {
      console.log('📤 Sending message:', messageText.substring(0, 30) + '...');
      const sentMessage = await this.chatService.sendMessage({
        chatRoomId: room.id,
        message: messageText,
        senderType: this.isAdmin() ? 'admin' : 'provider'
      });
      
      console.log('✅ Message sent successfully:', sentMessage.id);
      
      // Immediately add the sent message to the UI for instant feedback
      const currentMessages = this.messages();
      const messageExists = currentMessages.some(m => m.id === sentMessage.id);
      if (!messageExists) {
        console.log('➕ Adding sent message to chat immediately');
        this.messages.set([...currentMessages, sentMessage]);
        this.scrollToBottom = true;
      }
      
      this.newMessage.set('');
      
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }


  private scrollChatToBottom() {
    if (this.chatMessagesContainer) {
      const element = this.chatMessagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  toggleRightSidebar() {
    this.showRightSidebar.set(!this.showRightSidebar());
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  isMyMessage(message: ChatMessage): boolean {
    const currentUserData = this.userDataService.getCurrentUserData();
    return message.senderId === currentUserData?.id;
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  selectRoomById(roomId: string, retryCount = 0) {
    console.log('🔍 selectRoomById called with ID:', roomId, 'retry:', retryCount);
    const rooms = this.chatRooms();
    console.log('🏠 Available chat rooms:', rooms);
    console.log('🏠 Number of rooms:', rooms.length);
    
    const room = rooms.find(r => r.id === roomId);
    console.log('🎯 Found room:', room);
    
    if (room) {
      console.log('✅ Selecting room:', room.title);
      this.selectRoom(room);
    } else {
      console.log('❌ Room not found! Available room IDs:', rooms.map(r => r.id));
      console.log('❌ Looking for room ID:', roomId);
      
      // If room not found and we haven't retried too many times, reload rooms and try again
      if (retryCount < 3) {
        console.log('🔄 Reloading chat rooms and retrying...');
        setTimeout(async () => {
          await this.loadChatRooms();
          this.selectRoomById(roomId, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      }
    }
  }

  goBack() {
    this.router.navigate([this.backRoute()]);
  }

  private async findOrCreateProjectChatRoom(projectId: string, projectName: string) {
    try {
      console.log('🔍 Looking for existing chat room for project:', projectName, 'with projectId:', projectId);
      
      // Ensure user data is available first
      await this.waitForUserData();
      
      // Ensure rooms are loaded first
      await this.loadChatRooms();
      
      // Now check if a chat room already exists for this project
      const rooms = this.chatRooms();
      console.log('🏠 Available rooms:', rooms.map(r => ({id: r.id, title: r.title, projectId: r.projectId, roomType: r.roomType})));
      
      const existingRoom = rooms.find(room => 
        room.roomType === 'project' && 
        room.projectId === projectId
      );
      
      if (existingRoom) {
        console.log('✅ Found existing chat room:', existingRoom.title);
        this.selectRoom(existingRoom);
        return;
      }
      
      console.log('❌ No existing chat room found. Creating new project chat room...');
      
      // Get current user for participants
      const currentUser = this.userDataService.getCurrentUserData();
      const currentUserId = currentUser?.id || '';
      
      if (!currentUserId) {
        throw new Error('Current user ID not available');
      }
      
      // Create new project chat room
      const newRoom = await this.chatService.createProjectChatRoom({
        projectId: projectId,
        projectName: projectName,
        roomType: 'project',
        title: `${projectName} - Project Chat`,
        description: `Chat room for project: ${projectName}`,
        adminUsers: [currentUserId], // Add current user ID as admin
        providerUsers: []
      });
      
      console.log('✅ Created new project chat room:', newRoom.title);
      
      // Add the new room to our local list
      const updatedRooms = [...this.chatRooms(), newRoom];
      this.chatRooms.set(updatedRooms);
      
      // Select the newly created room
      this.selectRoom(newRoom);
      
    } catch (error) {
      console.error('❌ Error finding/creating project chat room:', error);
      // Still try to load rooms in case the error was just in selection
      await this.loadChatRooms();
    }
  }
}