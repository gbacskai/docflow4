# Dashboard Component

This directory contains the main dashboard component that serves as the central hub for authenticated users.

## Purpose
Primary landing page for authenticated users, providing overview and navigation to all application features.

## Files
- `dashboard.ts` - Main dashboard component with user state and navigation
- `dashboard.html` - Dashboard template with feature navigation and user info
- `dashboard.less` - Dashboard styling and layout
- `dashboard.spec.ts` - Unit tests for dashboard functionality

## Key Features

### User Overview
- **Current User Display** - Shows authenticated user information
- **Role-based Navigation** - Different options for admin vs regular users
- **Authentication State** - Integration with AuthService for user status

### Feature Navigation
Provides access to all main application features:
- **Document Management** - Access to documents and document types
- **Project Management** - Project creation and workflow assignment
- **Workflow Configuration** - Workflow design and rule management
- **User Account** - Profile management and settings
- **Administrative Tools** - Admin-only features when applicable

### Integration Points
- **AuthService** - User authentication state management
- **Route Guards** - Protected by `authGuard` for authenticated access only
- **Navigation Service** - Central hub for application flow

## User Experience
- **Responsive Design** - Mobile-friendly dashboard layout
- **Quick Actions** - Direct access to frequently used features
- **Status Indicators** - Visual feedback for user state and permissions

## Related Components
- Authentication: Protected by `auth-guard.ts`
- Navigation: Uses `navigation/` component for consistent app navigation
- User Management: Displays user info from `services/auth.service.ts`