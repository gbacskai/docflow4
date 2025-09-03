# Reset Password Component

This directory contains the password reset component for account recovery functionality.

## Purpose
Handles password reset requests and confirmation for users who have forgotten their passwords.

## Files
- `reset-password.ts` - Password reset component with email request and confirmation
- `reset-password.html` - Password reset form templates
- `reset-password.less` - Password reset page styling

## Key Features

### Password Recovery Flow
- **Email Request** - Users enter email to request password reset
- **Confirmation Code** - Cognito sends verification code via email
- **New Password Entry** - Secure new password creation with validation
- **Success Confirmation** - User feedback on successful password reset

### Security Features
- **Code Validation** - Verification code required for password changes
- **Password Strength** - Client-side validation for new passwords
- **Secure Process** - Complete password reset handled by AWS Cognito

## Integration
- **AuthService** - Uses `src/app/services/auth.service.ts` for Cognito password reset operations
- **Cognito Flow** - Standard AWS Cognito password reset process
- **Navigation** - Links back to auth page after successful reset

## Related Components
- Authentication: `src/app/auth/` for returning to login after reset
- Signup: Similar verification pattern used in registration flow
- Auth Service: Handles AWS Cognito password reset operations