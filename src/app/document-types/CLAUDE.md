# Document Types Component

This directory contains the document type configuration component with complex domain selection workflow.

## Purpose
Manages document type definitions, form schemas, and domain associations with an advanced temporary selection system.

## Files
- `document-types.ts` - Document type management with domain selection workflow
- `document-types.html` - Template with form builder and domain sidebar
- `document-types.less` - Styling for forms and domain selection interface
- `document-types.spec.ts` - Unit tests with complex domain selection testing

## Key Features

### Document Type Management
- **CRUD Operations** - Create, read, update, delete document types
- **JSON Schema Definitions** - Dynamic form schema stored in `definition` field
- **Category Organization** - Group document types by business categories
- **Usage Tracking** - Monitor document type usage and template counts

### Advanced Domain Selection Workflow
Complex temporary selection system with multi-step workflow:
1. **`openDomainSidebar()`** - Initializes `tempSelectedDomains` signal with current form values
2. **`toggleDomainInSidebar()`** - Modifies temporary selection (adds/removes domains)
3. **`applyDomainSelection()`** - Commits temporary selection to form via `patchValue()`

### State Flow Pattern
- **Form → Temp Selection → Form** - User confirmation workflow
- **Signal-based State** - Reactive temporary domain management
- **Form Integration** - Seamless integration with Angular reactive forms

## Testing Patterns

### Complex Test Requirements
- **Domain Selection Flow** - Tests must call `openDomainSidebar()` before domain toggles
- **Confirmation Step** - Tests must call `applyDomainSelection()` to update forms
- **fakeAsync Testing** - Requires `fakeAsync()` and `tick()` for form operations
- **Mock Client Override** - Component method mocking for AWS Amplify integration

## Data Integration
- **AWS Amplify** - Direct integration with DocumentType GraphQL model
- **JSON Schema Storage** - Form definitions stored as JSON strings
- **Validation Rules** - Optional validation rules for form fields

## Related Components
- Form Rendering: `src/app/shared/dynamic-form.component.ts`
- Workflows: Used in `src/app/workflows/` for rule configuration
- Documents: Referenced by `src/app/documents/` for form rendering