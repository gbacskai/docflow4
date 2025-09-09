# Authentication Component

This directory contains the user sign-in component for application authentication.

## Purpose
Provides email and password authentication interface with integration to AWS Cognito via Amplify Auth.

## Files
- `auth.ts` - Authentication component with sign-in form and validation
- `auth.html` - Sign-in form template with email/password fields
- `auth.less` - Authentication page styling
- `auth.spec.ts` - Unit tests for authentication functionality

## Key Features

### Sign-In Flow
- **Email/Password Authentication** - Standard Cognito login
- **Form Validation** - Client-side validation for email and password fields
- **Error Handling** - User-friendly error messages for authentication failures
- **Success Redirect** - Automatic navigation to dashboard on successful login

### Integration
- **AuthService** - Uses `src/app/services/auth.service.ts` for authentication operations
- **AWS Amplify** - Direct integration with Amplify Auth for Cognito operations
- **Reactive Forms** - Angular reactive forms for input validation

### User Experience
- **Responsive Design** - Mobile-friendly authentication interface
- **Loading States** - Visual feedback during authentication process
- **Accessibility** - Proper form labels and ARIA attributes

## Related Components
- Navigation: Links to signup, password reset, and email verification
- Route Guards: Works with `authGuard` to protect authenticated routes
- AuthService: `src/app/services/auth.service.ts` handles authentication state
- Landing: `src/app/landing/` provides conditional routing based on auth state