# Test Users Creation Function

This directory contains a Lambda function for creating test users in Cognito for development and testing purposes.

## Purpose
Provides RESTful endpoint to create pre-configured test users with proper roles and email verification for testing scenarios.

## Files
- `handler.ts` - Lambda handler for creating test users in Cognito
- `resource.ts` - Lambda function resource definition

## Test Users Created

### Admin User
- **Email**: test_admin@docflow4.com
- **Role**: admin
- **Name**: Test Admin
- **Password**: TestPass123!

### Client User  
- **Email**: test_client@docflow4.com
- **Role**: client
- **Name**: Test Client
- **Password**: TestPass123!

## Features

### Duplicate Prevention
- Checks for existing users before creation
- Graceful handling with skip counting for existing users
- No errors thrown for duplicate users

### User Configuration
- **Email Verification**: Users created with `email_verified: true`
- **Permanent Password**: Sets permanent password (no temporary password flow)
- **User Confirmation**: Automatically confirms user signup
- **Custom Attributes**: Sets role attribute for authorization

### Error Handling
- Comprehensive error handling with detailed logging
- Specific handling for `UsernameExistsException`
- Returns detailed results for each user creation attempt

## Response Format
Returns detailed results including:
- Count of created vs existing vs failed users
- Individual results for each user
- Shared password information for testing
- CORS headers for frontend access

## Usage
Call this function after creating a new sandbox environment to set up test users for automated testing and development.