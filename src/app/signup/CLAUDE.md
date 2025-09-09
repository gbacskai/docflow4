# Signup Component

This directory contains the user registration component for new user account creation.

## Purpose
Provides user registration interface with email verification integration via AWS Cognito.

## Files
- `signup.ts` - Signup component with registration form and validation
- `signup.html` - Registration form template with email and password fields
- `signup.less` - Signup page styling

## Key Features

### User Registration
- **Email/Password Registration** - Standard Cognito user creation
- **Form Validation** - Client-side validation for registration fields
- **Email Verification** - Automatic email verification process initiation
- **Error Handling** - User-friendly error messages for registration issues

### Registration Flow
1. User enters email and password
2. Cognito user created via AuthService
3. Verification email sent automatically
4. User redirected to verification page

## Integration
- **AuthService** - Uses `src/app/services/auth.service.ts` for Cognito operations
- **Verification Flow** - Links to `src/app/verify/` for email confirmation
- **AWS Cognito** - Direct integration via Amplify Auth

## Related Components
- Verification: `src/app/verify/` completes registration flow
- Authentication: `src/app/auth/` for returning users
- Auth Service: Handles actual Cognito user creation