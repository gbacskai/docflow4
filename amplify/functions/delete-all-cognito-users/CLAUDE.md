# Delete All Cognito Users Function

This Lambda function handles the deletion of all users from the Cognito User Pool as part of the admin "Clear All Data" functionality.

## Purpose
- Deletes ALL Cognito user accounts from the user pool
- Used by admin interface for complete system reset
- Part of the comprehensive data clearing process

## Function Details
- **Handler**: `handler.ts` - Main Lambda function logic
- **Resource**: `resource.ts` - Function definition and environment configuration
- **Dependencies**: AWS SDK Cognito Identity Provider client

## Key Features
- **Batch Processing** - Handles large numbers of users via pagination
- **Error Resilience** - Continues processing even if individual user deletion fails
- **Comprehensive Logging** - Tracks deletion progress and errors
- **Safety Confirmation** - Requires explicit confirmation parameter

## Security Considerations
- **Admin Only** - Should only be called by admin users
- **Destructive Operation** - Permanently deletes ALL user accounts
- **No Recovery** - Operation cannot be undone
- **Proper Permissions** - Lambda has minimal required Cognito permissions

## Integration
- Called via GraphQL query `deleteAllCognitoUsers`
- Part of admin component's `clearDatabase()` function
- Returns deletion count and success status