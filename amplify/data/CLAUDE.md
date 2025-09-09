# Data Layer Configuration

This directory contains the GraphQL schema and data model definitions for the DocFlow4 application.

## Purpose
Defines the complete data architecture using AWS Amplify's GraphQL schema with automatic DynamoDB table generation.

## Key Files
- `resource.ts` - Complete GraphQL schema definition with all models and relationships

## Data Models

### Core Business Models
- **Project** - Main containers with workflow assignment (`ownerId`, `workflowId`, status tracking)
- **Document** - Project-linked documents with `documentType` and JSON `formData` storage
- **DocumentType** - Form definitions with JSON schema in `definition` field
- **Workflow** - Rule-based automation with JSON `rules` array and actor permissions
- **User** - Cognito-linked users with role-based access (`admin`, `client`, `provider`)

### Chat System Models
- **ChatRoom** - Real-time messaging rooms with project/document context
- **ChatMessage** - Individual messages with sender info, attachments, and threading

### AI Integration
- **validateWorkflow** - AI-powered workflow generation using Claude 3 Sonnet

## Key Patterns

### Authorization
All models use `allow.publicApiKey()` with 30-day expiration for simplified access control.

### Data Storage
- **Dynamic Forms**: Documents store form data as JSON strings in `formData` field
- **Workflow Rules**: Complex validation rules stored as JSON arrays
- **Relationships**: Proper foreign key relationships between models

### Environment Naming
Tables automatically named with pattern: `ModelName-[AppSyncId]-{environmentName}`