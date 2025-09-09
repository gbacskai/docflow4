# Services Directory

This directory contains all Angular services that provide business logic and AWS integration for the application.

## Purpose
Centralized business logic layer with AWS Amplify integration, authentication management, and data operations.

## Service Files

### Authentication & User Management
- `auth.service.ts` - Core authentication service with Cognito integration and user state management
- `user-data.service.ts` - User profile data operations and Cognito attribute management
- `user-management.service.ts` - Administrative user CRUD operations

### Administrative Services
- `admin.service.ts` - Administrative functions including database backup/restore/clear operations

### Communication Services
- `chat.service.ts` - Real-time chat functionality with DynamoDB integration for ChatRoom and ChatMessage models

### Form Services
- `dynamic-form.service.ts` - Dynamic form generation and validation from DocumentType schemas

## Architecture Patterns

### AWS Amplify Integration
All services follow consistent patterns for AWS integration:
- Direct imports from `aws-amplify/auth`, `aws-amplify/data`, `aws-amplify/storage`
- Use of `generateClient()` for GraphQL operations
- Proper error handling for AWS service calls

### Signal-based State Management
Services use Angular signals for reactive state management:
```typescript
private _currentUser = signal<AuthUser | null>(null);
currentUser = this._currentUser.asReadonly();
```

### Service Abstraction
- Services abstract AWS operations from components
- Consistent error handling and loading states
- Type-safe interfaces with proper TypeScript definitions

## Testing Patterns
- Services require AWS service mocking in tests
- Use component method overriding for Amplify ES module integration
- Centralized test helpers in `src/test-helpers.ts`