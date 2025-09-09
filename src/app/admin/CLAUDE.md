# Admin Component

This directory contains the administrative interface component for system management and data operations.

## Purpose
Provides comprehensive administrative functionality including user management, database operations, and system configuration for admin users only.

## Files
- `admin.ts` - Admin component with database management and user operations
- `admin.html` - Admin interface template with data management controls
- `admin.less` - Admin-specific styling
- `admin.spec.ts` - Unit tests for admin functionality

## Key Features

### Database Management
- **Backup/Restore** - JSON-based export/import of all application data
- **Clear Database** - Complete data deletion with double confirmation
- **Sample Data Initialization** - Create test data for development
- **Table Names Display** - Shows physical DynamoDB table names for debugging

### User Management
- **User CRUD Operations** - Create, read, update, delete users
- **Role Management** - Assign admin/client/provider roles
- **User Status Control** - Activate/deactivate user accounts

### Data Operations
- **Cross-table Operations** - Coordinated operations across DocumentTypes, Workflows, Projects, and Documents
- **Referential Integrity** - Proper cleanup when deleting dependent records

## Access Control
- **Admin Guard** - Protected by `adminGuard` route guard
- **Role Verification** - Only accessible to users with admin privileges
- **UI Protection** - Admin-only features hidden from non-admin users

## Related Components
- Route Protection: `src/app/admin-guard.ts`
- User Management: `src/app/services/user-management.service.ts`
- Database Operations: `src/app/services/admin.service.ts`