# Source Code Directory

This directory contains the complete frontend Angular application source code.

## Purpose
Houses all Angular 20 application code including components, services, routing, and styling for the DocFlow4 document management system.

## Key Files
- `main.ts` - Application bootstrap and entry point
- `index.html` - HTML template with Angular app root
- `styles.less` - Global LESS styles and theme variables
- `test-helpers.ts` - Centralized testing utilities and AWS service mocking

## Architecture

### Application Structure
- **Standalone Components** - Uses Angular 20's standalone component architecture
- **Signal-based State** - Reactive state management throughout the application
- **Feature-based Organization** - Each feature in separate directory with component, template, styles, and tests

### Subdirectories

#### Core Application (`app/`)
- **Root Components** - App shell, routing, and configuration
- **Guards** - Authentication and authorization route guards
- **Feature Components** - All business logic components (dashboard, documents, workflows, etc.)
- **Services** - Business logic and AWS integration services
- **Shared** - Reusable components and utilities
- **Types** - TypeScript type definitions (currently empty)

### Technology Stack
- Angular 20.2.0 with standalone components
- TypeScript with strict configuration
- LESS preprocessor for styling
- Signal-based reactive programming
- AWS Amplify v6 integration