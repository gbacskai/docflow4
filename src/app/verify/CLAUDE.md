# Verify Component

This directory contains the email verification component for completing user registration.

## Purpose
Handles email verification code entry to complete the user registration process with AWS Cognito.

## Files
- `verify.ts` - Verification component with confirmation code handling
- `verify.html` - Verification form template with code input field
- `verify.less` - Verification page styling

## Key Features

### Email Verification
- **Confirmation Code Entry** - Input field for 6-digit verification code
- **Code Validation** - Client-side validation for confirmation code format
- **Automatic Verification** - Submits code to Cognito for verification
- **Success Redirect** - Automatic login and redirect to dashboard on successful verification

### User Experience
- **Clear Instructions** - Guidance for finding and entering verification code
- **Resend Functionality** - Option to request new verification email
- **Error Handling** - User-friendly messages for invalid or expired codes

## Registration Flow Integration
1. User completes signup in `src/app/signup/`
2. Verification email sent by Cognito
3. User enters code in this component
4. Account activated and user logged in automatically

## Integration
- **AuthService** - Uses `src/app/services/auth.service.ts` for Cognito verification
- **Signup Flow** - Completes registration started in `src/app/signup/`
- **Dashboard Redirect** - Success leads to authenticated dashboard access

## Related Components
- Signup: `src/app/signup/` initiates verification flow
- Auth: `src/app/auth/` for already-verified users
- Dashboard: Destination after successful verification