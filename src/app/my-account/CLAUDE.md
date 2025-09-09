# My Account Component

This directory contains the user profile management component for account settings and personal information.

## Purpose
Allows authenticated users to view and update their personal account information and preferences.

## Files
- `my-account.ts` - Account management component with profile editing
- `my-account.html` - Account settings template with user profile forms
- `my-account.less` - Account page styling

## Key Features

### Profile Management
- **User Information** - Display and edit personal details (name, email, etc.)
- **Account Settings** - User preferences and configuration options
- **Security Settings** - Password change and account security options

### Data Integration
- **User Model** - Integrates with User data model for profile information
- **Cognito Integration** - Syncs with AWS Cognito user attributes
- **Real-time Updates** - Immediate reflection of profile changes

## Access Control
- **Authentication Required** - Protected by `authGuard` route guard
- **User Context** - Users can only edit their own account information

## Related Components
- User Data: Uses `src/app/services/user-data.service.ts` for profile operations
- Authentication: Works with `src/app/services/auth.service.ts` for user context
- Navigation: Accessible via user menu in main navigation