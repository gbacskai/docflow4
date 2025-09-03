# Shared Components Directory

This directory contains reusable components and utilities shared across the application.

## Purpose
Houses common components and utilities that are used by multiple features throughout the application.

## Files
- `dynamic-form.component.ts` - Reusable dynamic form component for rendering DocumentType schemas
- `dynamic-form.less` - Styling for dynamic form fields and layouts

## Key Components

### DynamicFormComponent
- **Schema-driven Rendering** - Generates forms from JSON schema definitions
- **Field Type Support** - Handles various input types (text, number, date, select, etc.)
- **Validation Integration** - Built-in validation based on schema rules
- **Reactive Forms** - Angular reactive forms integration

## Usage Patterns

### DocumentType Integration
- Used by `src/app/documents/` for document form rendering
- Schema definitions come from `src/app/document-types/` definitions
- Form data stored as JSON in Document `formData` field

### Form Schema Processing
- Parses DocumentType `definition` field JSON schema
- Dynamically creates form controls and validation
- Handles complex field relationships and dependencies

## Architecture
- **Standalone Component** - Uses Angular 20 standalone architecture
- **Signal Integration** - Works with signal-based state management
- **Service Integration** - Uses `src/app/services/dynamic-form.service.ts` for processing logic

## Related Components
- Document Types: Source of form schema definitions
- Documents: Primary consumer for document instance forms
- Dynamic Form Service: Business logic for form processing