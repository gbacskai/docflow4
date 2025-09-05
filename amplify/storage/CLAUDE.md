# Storage Configuration

This directory defines the S3 storage configuration for file management in the DocFlow4 application.

## Purpose
Configures AWS S3 bucket for document uploads, attachments, and file storage with proper access control.

## Files
- `resource.ts` - S3 storage resource definition with path-based access control

## Storage Structure

### Bucket Naming
- **Pattern**: `docflow4-{environmentName}` (e.g., `docflow4-dev001`)
- **Environment**: Determined by `AWS_BRANCH` or defaults to `dev`

### Access Patterns
- **documents/*** - Private storage for authenticated users only
  - Full CRUD access for authenticated users
  - Used for document attachments and uploads
- **public/*** - Public readable storage
  - Guest users can read
  - Authenticated users have full CRUD access
  - Used for shared resources and public assets

## Security
- Path-based access control using Amplify Storage policies
- Authentication required for private documents
- Automatic user context for access validation

## Related Components
- Frontend integration via `aws-amplify/storage`
- Document upload functionality in Documents component
- Chat file sharing in Chat component