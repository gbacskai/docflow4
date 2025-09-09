# Angular Application Core

This directory contains the core Angular application structure with all components, services, routing, and business logic.

## Purpose
Main application directory containing all Angular components, services, routing configuration, and feature implementations for the document flow management system.

## Key Files

### Application Core
- `app.ts` - Root app component with navigation and user authentication state
- `app.routes.ts` - Complete routing configuration with guards
- `app.config.ts` - Application-wide configuration and providers
- `shared-styles.less` - Common LESS styles shared across components

### Route Guards
- `auth-guard.ts` - Authentication protection for private routes
- `admin-guard.ts` - Admin-only route protection

## Component Architecture

### Authentication Flow
- `landing/` - Smart landing page with conditional routing
- `auth/` - Sign in form with validation
- `signup/` - User registration with email verification
- `verify/` - Email verification code entry
- `reset-password/` - Password reset functionality

### Main Application Features
- `dashboard/` - Main authenticated user dashboard
- `admin/` - Administrative interface (admin users only)
- `home/` - Home page component
- `my-account/` - User profile management

### Document Management
- `document-types/` - Document type configuration with complex domain selection workflow
- `documents/` - Document management and file operations  
- `projects/` - Project organization with workflow assignment
- `workflows/` - Workflow management with visual flowchart and rule validation

### User Management
- `users/` - User management interface (admin feature)
- `user-menu/` - User account dropdown menu
- `navigation/` - Main application navigation

### Communication
- `chat/` - Real-time messaging with project/document context
- `reporting/` - Analytics and reporting interface

## Service Layer (`services/`)
- **AuthService** - Authentication state and operations
- **AdminService** - Administrative functions and database operations
- **UserDataService** - User profile data operations
- **UserManagementService** - User CRUD operations
- **ChatService** - Real-time chat functionality
- **DynamicFormService** - Dynamic form rendering and validation

## Shared Components (`shared/`)
- **DynamicFormComponent** - Reusable form component for DocumentType definitions

## Technology Patterns
- **Standalone Components** - No NgModule usage, direct imports
- **Signal-based State** - Reactive programming with Angular signals
- **Functional Route Guards** - Modern guard implementation
- **AWS Amplify Integration** - Direct service imports for auth, data, storage