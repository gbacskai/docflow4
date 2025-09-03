# Custom Resources Configuration

This directory contains custom AWS CDK resources that extend the standard Amplify-generated infrastructure.

## Purpose
Creates additional DynamoDB tables with consistent environment-based naming that runs alongside Amplify's GraphQL tables.

## Files
- `all-tables.ts` - Comprehensive DynamoDB table creation with proper naming and indexing

## Table Definitions

### Core Business Tables
- **Project Table** - Main project container with simple partition key
- **Document Table** - Project-linked documents with ProjectIndex GSI
- **User Table** - User management with EmailIndex and CognitoUserIndex GSIs
- **DocumentType Table** - Document type definitions
- **Workflow Table** - Workflow configurations

### Chat System Tables
- **ChatRoom Table** - Chat rooms with ProjectIndex and DocumentIndex GSIs, DynamoDB streams enabled
- **ChatMessage Table** - Messages with composite key (chatRoomId, timestamp), SenderIndex and ThreadIndex GSIs, DynamoDB streams enabled

## Architecture Features

### Naming Convention
- **Pattern**: `docflow4-{TableName}-{environmentName}`
- **Environment Resolution**: `AMPLIFY_BRANCH` > context value > `dev`
- **Consistency**: Matches GraphQL table naming for unified resource management

### Advanced Features
- **DynamoDB Streams**: Enabled on ChatRoom and ChatMessage tables for real-time processing
- **Global Secondary Indexes**: Strategic indexing for efficient queries
- **Stream Integration**: Configures event sources for Lambda functions when provided
- **Environment Awareness**: Automatic environment detection and naming

### Infrastructure Management
- **Pay-per-request billing** for all tables
- **Removal policy DESTROY** for development environments
- **Proper IAM permissions** for stream reading when Lambda functions are configured