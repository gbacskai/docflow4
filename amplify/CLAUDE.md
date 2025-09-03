# Amplify Backend Configuration

This directory contains the AWS Amplify v6 backend configuration for the DocFlow4 application.

## Purpose
Defines the complete AWS infrastructure including authentication, data layer, storage, and serverless functions for the document flow management system.

## Key Files
- `backend.ts` - Main backend definition with auth, data, and storage resources
- `package.json` - Backend-specific dependencies and scripts
- `tsconfig.json` - TypeScript configuration for backend code

## Architecture
- **Environment Management**: Automatic environment naming based on git branch
- **Table Naming Convention**: `docflow4-{ResourceType}-{Branch}` pattern
- **Resource Organization**: Modular structure with separate resource definitions

## Subdirectories
- `auth/` - Cognito authentication configuration
- `data/` - GraphQL API and DynamoDB schema definitions  
- `storage/` - S3 bucket configuration for file uploads
- `functions/` - Lambda functions for chat streaming and data initialization
- `chat-storage/` - Custom DynamoDB tables for real-time messaging
- `custom-resources/` - Additional AWS resources and custom configurations

## Environment Variables
Backend uses branch-based naming:
- `AMPLIFY_BRANCH` or git branch determines environment suffix
- Resources automatically prefixed with `docflow4-`
- Supports multiple environments (dev, staging, prod)

## Development Commands
- `npx ampx generate outputs` - Generate amplify_outputs.json
- `npx ampx sandbox --profile aws_amplify_permithunter --identifier 00003` - Local development