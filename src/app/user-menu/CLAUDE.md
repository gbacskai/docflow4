# User Menu Component

This directory contains the user dropdown menu component for account actions and navigation.

## Purpose
Provides user account dropdown menu with profile access, account settings, and logout functionality.

## Files
- `user-menu.ts` - User menu component with dropdown logic and user actions
- `user-menu.html` - Dropdown menu template with user options
- `user-menu.less` - Styling for dropdown menu and user interface elements
- `user-menu.spec.ts` - Unit tests for user menu functionality

## Key Features

### User Account Actions
- **Profile Information** - Display current user name and email
- **Account Settings** - Quick access to `src/app/my-account/` component
- **Logout Functionality** - Secure user logout with session cleanup
- **Role Display** - Show user role (admin/client/provider) when applicable

### Dropdown Interface
- **Click Toggle** - Dropdown menu activation and deactivation
- **Outside Click** - Menu closes when clicking outside dropdown area
- **Keyboard Navigation** - Accessible menu navigation with keyboard support

### Integration Points
- **AuthService** - User state management and logout operations
- **Navigation** - Integrated into main navigation component
- **User Context** - Displays current authenticated user information

## User Experience
- **Responsive Design** - Mobile-friendly dropdown behavior
- **Visual Feedback** - Clear indication of user state and available actions
- **Quick Actions** - Fast access to frequently used account functions

## Related Components
- Navigation: `src/app/navigation/` incorporates this user menu
- My Account: `src/app/my-account/` destination for profile management
- Auth Service: `src/app/services/auth.service.ts` provides user state and logout