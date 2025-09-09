# Production User Creation Guide

This guide explains how to create users in the production AWS environment.

## Why Test Users Aren't Created in Deployment

AWS Amplify's build role doesn't have `cognito-idp:AdminCreateUser` permissions by default. This is intentional for security - production user creation should be controlled.

## Options for Production Users

### Option 1: Self-Registration (Recommended)
Users can register themselves through the application:
1. Go to the application login page
2. Click "Create account"
3. Enter email and password
4. Verify email with the sent code
5. Log in normally

### Option 2: Admin Creation via AWS Console
1. Go to AWS Cognito in the AWS Console
2. Find your User Pool (search for your app name)
3. Click "Users" → "Create user"
4. Enter email and temporary password
5. User must change password on first login

### Option 3: AWS CLI (for admins)
```bash
# Get your User Pool ID from amplify_outputs.json
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

### Option 4: Local Test Users (Development Only)
For local development, test users can be created:
```bash
# In your local environment
AWS_PROFILE=your_profile node scripts/create-test-users.js
```

## Production User Management

- Users should register through the application UI
- Admin users need to be assigned roles after registration
- Use the built-in user management features in the admin panel
- Never hardcode production credentials

## Security Notes

- Test user creation is disabled in production for security
- Use proper IAM roles and policies
- Enable MFA for admin accounts
- Regular user access reviews recommended