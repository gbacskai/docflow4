# Lambda Functions

This directory contains AWS Lambda functions that provide server-side functionality for the DocFlow4 application.

## Purpose
Houses serverless functions for real-time chat processing and database initialization functionality.

## Subdirectories

### chat-stream-handler/
DynamoDB stream processor for real-time chat message handling (currently disabled in backend.ts).

### init-sample-data/  
Lambda function for seeding the database with sample DocumentTypes and Workflows.

## Architecture
- **Environment Awareness**: Functions automatically use branch-based table naming
- **Table Naming**: Follows `docflow4-{ResourceType}-{environmentName}` pattern
- **Error Handling**: Comprehensive error handling with detailed logging
- **Integration**: Direct DynamoDB access using AWS SDK v3

## Current Status
- Chat stream handler is temporarily disabled pending CDK integration resolution
- Sample data function provides initialization for development and testing environments