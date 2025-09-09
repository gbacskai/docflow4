# Landing Component

This directory contains the smart landing page that provides conditional routing based on user authentication status.

## Purpose
Intelligent entry point that routes users to appropriate pages based on their authentication state and role.

## Files
- `landing.ts` - Landing component with conditional routing logic
- `landing.html` - Landing page template with authentication state handling
- `landing.less` - Landing page styling

## Key Features

### Smart Routing
- **Authentication Detection** - Checks user authentication status on load
- **Conditional Redirect** - Routes authenticated users to dashboard, unauthenticated to auth
- **Role Awareness** - Can route based on user roles (admin vs regular users)

### User Experience
- **Seamless Flow** - Invisible routing for authenticated users
- **Welcome Interface** - Friendly entry point for new users
- **Loading States** - Handles authentication state detection gracefully

## Access Control
- **Landing Guard** - Protected by `landingGuard` for intelligent routing
- **Authentication Integration** - Works with AuthService to determine user state

## Related Components
- Auth Flow: Routes to `auth/`, `signup/`, `verify/` components
- Dashboard: Primary destination for authenticated users
- Route Guards: Uses `landingGuard` from `auth-guard.ts`