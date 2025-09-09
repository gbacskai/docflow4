# Chat Component

This directory contains the real-time messaging component for project and document-based communication.

## Purpose
Provides real-time chat functionality with context-aware messaging for projects and documents.

## Files
- `chat.ts` - Chat component with real-time messaging and room management
- `chat.html` - Chat interface template with message display and input
- `chat.less` - Chat-specific styling for message bubbles and UI

## Key Features

### Real-time Messaging
- **Project/Document Context** - Chat rooms linked to specific projects or documents
- **Message Threading** - Support for message replies and conversations
- **File Sharing** - Attachment uploads via AWS S3 storage
- **Participant Management** - Admin and provider user roles in chat rooms

### Chat Rooms
- **Room Types** - Separate rooms for projects (`project`) and documents (`document`)
- **Participant Lists** - Admins, providers, and general participants
- **Room Metadata** - Last message tracking, unread counts, activity timestamps
- **Archive Support** - Room archival and status management

### Message Features
- **Message Types** - Text, system notifications, and file attachments
- **Read Status** - Track message read state per user
- **Sender Information** - Display sender name, email, and role
- **Timestamp Display** - Message creation and edit timestamps

## Integration
- **ChatService** - Uses `src/app/services/chat.service.ts` for all chat operations
- **AWS Storage** - File attachments stored in S3 via Amplify Storage
- **Real-time Updates** - Polling-based updates (WebSocket integration pending)

## Data Models
- Backend tables: ChatRoom and ChatMessage (defined in `amplify/data/resource.ts`)
- Custom DynamoDB tables with streams (defined in `amplify/custom-resources/all-tables.ts`)
- Stream processing via `amplify/functions/chat-stream-handler/` (currently disabled)