import type { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent) => {
  console.log('Chat stream event received:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    await processRecord(record);
  }
};

async function processRecord(record: DynamoDBRecord) {
  console.log('Processing record:', record.eventName);

  // Handle different event types
  switch (record.eventName) {
    case 'INSERT':
      if (record.dynamodb?.NewImage) {
        await handleNewMessage(record.dynamodb.NewImage);
      }
      break;
    case 'MODIFY':
      if (record.dynamodb?.NewImage) {
        await handleMessageUpdate(record.dynamodb.NewImage);
      }
      break;
    case 'REMOVE':
      if (record.dynamodb?.OldImage) {
        await handleMessageDelete(record.dynamodb.OldImage);
      }
      break;
  }
}

async function handleNewMessage(newImage: any) {
  // Check if this is a ChatMessage (has chatRoomId and message fields)
  if (newImage.chatRoomId && newImage.message) {
    const message = {
      id: newImage.id?.S,
      chatRoomId: newImage.chatRoomId?.S,
      senderId: newImage.senderId?.S,
      senderName: newImage.senderName?.S,
      message: newImage.message?.S,
      timestamp: newImage.timestamp?.S,
      messageType: newImage.messageType?.S || 'text'
    };

    console.log('New chat message:', message);
    
    // TODO: Implement WebSocket broadcasting to connected clients
    // This would require setting up API Gateway WebSocket connections
    // and maintaining connection IDs in a separate table
  }
}

async function handleMessageUpdate(newImage: any) {
  console.log('Message updated:', newImage);
  // Handle message updates (read status, edits, etc.)
}

async function handleMessageDelete(oldImage: any) {
  console.log('Message deleted:', oldImage);
  // Handle message deletions
}