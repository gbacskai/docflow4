# Projects Component

This directory contains the project management component for organizing documents and assigning workflows.

## Purpose
Central project management interface for creating, organizing, and managing projects with workflow assignments and document organization.

## Files
- `projects.ts` - Project management component with CRUD operations and workflow assignment
- `projects.html` - Project interface template with project forms and lists
- `projects.less` - Project-specific styling and layout
- `projects.spec.ts` - Unit tests for project functionality

## Key Features

### Project Management
- **Project CRUD** - Create, read, update, delete projects with owner assignment
- **Workflow Assignment** - Link projects to specific workflows for document processing
- **Owner Management** - Set project ownership and admin user assignments
- **Status Tracking** - Project status management (active, completed, archived)

### Document Organization
- **Document Context** - Projects serve as containers for related documents
- **Type Association** - Projects work with DocumentTypes for document creation
- **File Management** - Organization of project-related files and attachments

### Workflow Integration
- **Workflow Selection** - Choose workflows during project creation
- **Process Automation** - Projects inherit workflow rules and processing logic
- **Actor Assignments** - Manage user roles within project workflows

## Data Relationships

### Core Associations
- **Project → Documents** - One-to-many relationship via `projectId`
- **Project → Workflow** - Many-to-one relationship via `workflowId`
- **Project → Users** - Owner and admin user assignments
- **Project → Chat** - Project-specific chat rooms for collaboration

## Access Control
- **Authentication Required** - Protected by `authGuard` route guard
- **Owner Permissions** - Project owners have full management access
- **Admin Override** - Admin users can manage all projects

## Related Components
- Documents: `src/app/documents/` creates documents within project context
- Workflows: `src/app/workflows/` defines assignable workflows
- Chat: `src/app/chat/` provides project-specific communication