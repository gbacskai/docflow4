# Documents Component

This directory contains the document management component for handling document instances and file operations.

## Purpose
Manages document instances linked to projects, handles dynamic form rendering based on document types, and provides file upload/download functionality.

## Files
- `documents.ts` - Document management component with form rendering and file operations
- `documents.html` - Template for document list, forms, and file management
- `documents.less` - Styling for document interface and form layouts

## Key Features

### Document Management
- **Project-linked Documents** - Documents associated with specific projects via `projectId`
- **Dynamic Form Rendering** - Uses DocumentType definitions to generate forms dynamically
- **Form Data Storage** - Document data stored as JSON in `formData` field
- **Status Tracking** - Document status management and workflow integration

### File Operations
- **Upload Functionality** - File attachments via AWS S3 storage
- **Download Support** - Retrieve and display uploaded documents
- **File Metadata** - Track file names, sizes, and upload timestamps
- **Storage Integration** - Uses `documents/*` path in S3 for private file storage

### Dynamic Forms
- **Schema-based Rendering** - Generates forms from DocumentType `definition` field
- **Field Validation** - Validates form data against DocumentType schema
- **Form State Management** - Reactive form handling with Angular signals

## Data Flow

### Form Rendering Process
1. Load DocumentType definition from backend
2. Parse JSON schema from `definition` field
3. Render dynamic form using DynamicFormComponent
4. Store completed form data as JSON in Document's `formData` field

### File Upload Process
1. User selects files via form interface
2. Files uploaded to S3 using Amplify Storage
3. File metadata stored in document record
4. File URLs generated for download access

## Integration
- **DynamicFormService** - Service for form schema processing
- **AWS Storage** - S3 integration via `aws-amplify/storage`
- **Project Context** - Documents always linked to parent projects
- **DocumentType Definitions** - Form structure from `src/app/document-types/`

## Related Components
- Projects: Documents are created within project contexts
- Document Types: Form schemas define document structure
- Shared: Uses `src/app/shared/dynamic-form.component.ts` for rendering