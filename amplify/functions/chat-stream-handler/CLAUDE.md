# Chat Stream Handler Function

This directory contains a Lambda function designed to handle real-time chat message processing via DynamoDB streams.

## Purpose
Processes DynamoDB stream events from ChatMessage table changes to enable real-time chat functionality.

## Files
- `handler.ts` - DynamoDB stream event processor for chat messages
- `resource.ts` - Lambda function resource definition

## Functionality

### Event Processing
Handles three types of DynamoDB events:
- **INSERT** - New chat messages (`handleNewMessage`)
- **MODIFY** - Message updates like read status (`handleMessageUpdate`) 
- **REMOVE** - Message deletions (`handleMessageDelete`)

### Current Implementation
- Basic event logging and processing structure
- Message extraction from DynamoDB stream format
- Preparation for WebSocket broadcasting (TODO)

## Status
**Currently Disabled** - Commented out in `amplify/backend.ts` pending CDK integration resolution.

## Future Enhancements
- WebSocket API Gateway integration for real-time message broadcasting
- Connection ID management for active chat participants
- Push notification integration for offline users
- Message delivery confirmation system