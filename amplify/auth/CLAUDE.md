# Authentication Configuration

This directory defines the AWS Cognito authentication setup for the DocFlow4 application.

## Purpose
Configures user authentication and authorization using AWS Amplify Auth with Cognito User Pools.

## Files
- `resource.ts` - Authentication resource definition with email-based login

## Configuration
- **Login Method**: Email and password authentication
- **Required Attributes**: Email address is mandatory for all users
- **User Pool**: Automatically managed by Amplify with environment-specific naming

## Features
- Email-based user registration and login
- Password reset functionality
- User attribute validation
- Integration with Angular AuthService for frontend state management

## Related Components
- Frontend: `src/app/auth/`, `src/app/services/auth.service.ts`
- Guards: `src/app/auth-guard.ts`, `src/app/admin-guard.ts`
- Routes: Protected routes require authentication via `authGuard`