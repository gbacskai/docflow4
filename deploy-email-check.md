# Deploy Email Duplication Check Function

## Overview
Created a Lambda function to prevent email duplication when creating new users.

## Components Created

### 1. Lambda Function
- **Location**: `amplify/functions/check-email-duplicate/`
- **Purpose**: Query Users DynamoDB table to check for existing email addresses
- **Method**: Efficient DynamoDB scan with filter expression
- **Response**: Returns `{ isDuplicate: boolean, message: string, existingUserId: string }`

### 2. GraphQL Integration  
- **Query**: `checkEmailDuplicate(email: String!)`
- **Authorization**: Public API key access
- **Handler**: Connects to the Lambda function

### 3. Frontend Integration
- **Service Method**: `UserManagementService.checkEmailDuplicate()`
- **Validation**: `UserManagementService.validateEmailForCreation()`
- **Integration Point**: `Users.createUser()` method calls validation before user creation

## Deployment Steps

1. **Deploy Backend**: Run `npx ampx sandbox` to deploy the new Lambda function
2. **Test Function**: Create a test user, then try to create another user with the same email
3. **Verify Error**: Should receive "Email address already exists" error

## Usage
The email duplication check is automatically triggered when:
- Admin users create new users via the Users component  
- The system attempts to create any new user record
- Email validation occurs before any Cognito user creation

## Error Handling
- Returns clear error messages for duplicate emails
- Graceful degradation if Lambda function fails
- Maintains data integrity while providing user feedback

## Security
- Read-only access to Users DynamoDB table
- Case-insensitive email comparison
- Only checks active user records (ignores archived users)