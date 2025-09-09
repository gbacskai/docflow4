# Users Component

This directory contains the user management component for administrative user operations.

## Purpose
Administrative interface for managing system users, roles, and account status (admin users only).

## Files
- `users.ts` - User management component with CRUD operations and role assignment
- `users.html` - User management template with user list and editing forms
- `users.less` - Styling for user management interface

## Key Features

### User Administration
- **User CRUD Operations** - Create, read, update, delete user accounts
- **Role Management** - Assign and modify user roles (admin, client, provider)
- **Status Control** - Activate, deactivate, and archive user accounts
- **Profile Management** - Edit user details and contact information

### User Organization
- **User Listing** - Comprehensive view of all system users
- **Search and Filter** - Find users by name, email, or role
- **Bulk Operations** - Multi-user actions for efficient administration
- **Status Tracking** - Visual indicators for user account status

### Security Features
- **Admin-only Access** - Restricted to admin role users
- **Audit Logging** - Track user management actions
- **Permission Validation** - Ensure proper access control for sensitive operations

## Integration
- **UserManagementService** - Uses `src/app/services/user-management.service.ts` for data operations
- **AWS Cognito** - User account synchronization with Cognito User Pool
- **Database Integration** - User model integration with DynamoDB tables

## Access Control
- **Admin Guard** - Protected by `adminGuard` route guard
- **Role Verification** - Only admin users can access user management
- **Permission Enforcement** - UI elements hidden based on user permissions

## Related Components
- Admin: `src/app/admin/` provides additional administrative functions
- User Management Service: Core business logic for user operations
- Auth Service: Authentication context and role validation