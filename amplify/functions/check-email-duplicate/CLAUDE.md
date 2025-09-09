# Email Duplicate Check Function

This directory contains a Lambda function that prevents email duplication in the Users DynamoDB table.

## Purpose
Provides server-side email duplication validation to ensure unique email addresses across all users before account creation.

## Files
- `handler.ts` - Lambda handler that queries Users table for existing email addresses
- `resource.ts` - Lambda function resource definition with DynamoDB permissions
- `package.json` - Function dependencies including AWS SDK for DynamoDB
- `tsconfig.json` - TypeScript configuration for function compilation

## Functionality

### Email Duplication Check
- **Case-insensitive Validation** - Converts emails to lowercase for comparison
- **Active Users Only** - Only checks against active users (excludes archived/inactive)
- **Efficient Query** - Uses DynamoDB scan with filter expression for performance
- **Detailed Response** - Returns duplication status, message, and existing user ID

### Response Format
```typescript
{
  isDuplicate: boolean,
  message: string,
  existingUserId: string | null
}
```

### Error Handling
- **Configuration Errors** - Validates environment variables and table access
- **DynamoDB Errors** - Handles database connectivity and permission issues  
- **Graceful Degradation** - Returns appropriate errors without breaking user flow

## Integration

### GraphQL Query
Exposed via GraphQL API as `checkEmailDuplicate` query:
```graphql
query CheckEmailDuplicate($email: String!) {
  checkEmailDuplicate(email: $email) {
    isDuplicate
    message
    existingUserId
  }
}
```

### Frontend Integration
Used by `UserManagementService.validateEmailForCreation()` method to prevent duplicate user creation.

### Backend Configuration
- **DynamoDB Permissions** - Read access to Users table via IAM policy
- **Environment Variables** - Automatic table name injection via Amplify
- **Error Logging** - Comprehensive CloudWatch logging for debugging

## Security
- **Public API Access** - Uses Amplify's public API key authorization
- **Read-only Access** - Function only queries data, never modifies Users table
- **Input Validation** - Validates email parameter before processing

## Usage
This function is automatically called before user creation to ensure email uniqueness and maintain data integrity across the system.