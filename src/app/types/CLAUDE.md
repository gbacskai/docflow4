# Types Directory

This directory is intended for TypeScript type definitions and interfaces shared across the application.

## Purpose
Centralized location for TypeScript type definitions, interfaces, and type utilities used throughout the Angular application.

## Current Status
**Empty Directory** - Currently contains no files but is reserved for future type definitions.

## Expected Content
This directory would typically contain:
- **Interface Definitions** - Business model interfaces and API response types
- **Type Utilities** - Common TypeScript utility types
- **Enum Definitions** - Application-specific enumerations
- **AWS Model Types** - Type definitions for AWS Amplify generated models

## Usage Patterns
When populated, types would typically be imported as:
```typescript
import { UserType, DocumentStatus } from '../types/user.types';
import { ProjectModel, DocumentModel } from '../types/api.types';
```

## Related Components
- All components would import shared types from this directory
- Services would use type definitions for AWS integration
- API integration would benefit from strongly-typed interfaces

## Implementation Recommendations
Consider adding type files for:
- User roles and permissions
- Document and project status enums
- Form field type definitions
- AWS model interfaces
- API response structures