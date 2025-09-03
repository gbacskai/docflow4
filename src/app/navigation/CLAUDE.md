# Navigation Component

This directory contains the main application navigation component providing consistent site-wide navigation.

## Purpose
Provides primary navigation interface with role-based menu options and user authentication integration.

## Files
- `navigation.ts` - Navigation component with menu logic and user state
- `navigation.html` - Navigation template with menu items and user controls
- `navigation.less` - Navigation styling and responsive design
- `navigation.spec.ts` - Unit tests for navigation functionality

## Key Features

### Role-based Navigation
- **Dynamic Menu Items** - Menu options change based on user role (admin vs regular user)
- **Authentication State** - Different navigation for authenticated vs unauthenticated users
- **Permission-based Visibility** - Admin-only items hidden from regular users

### User Controls
- **User Menu Integration** - Includes user account dropdown and logout functionality
- **Authentication Status** - Visual indicators for login state
- **Profile Access** - Quick access to user account settings

### Responsive Design
- **Mobile Navigation** - Collapsible menu for mobile devices
- **Desktop Layout** - Full navigation bar for desktop interfaces
- **Accessibility** - Proper ARIA labels and keyboard navigation support

## Integration
- **AuthService** - Uses authentication service for user state and logout
- **User Menu** - Incorporates `src/app/user-menu/` component
- **Route Navigation** - Angular router integration for page navigation

## Related Components
- User Menu: `src/app/user-menu/` provides dropdown functionality
- Auth Guard: Navigation items respect route guard protection
- All Components: Shared navigation used across entire application