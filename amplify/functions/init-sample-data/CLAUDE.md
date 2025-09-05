# Sample Data Initialization Function

This directory contains a Lambda function for seeding the database with sample data for development and testing.

## Purpose
Provides RESTful endpoint to initialize DocumentTypes and Workflows with realistic sample data for development environments.

## Files
- `handler.ts` - Lambda handler for database seeding operations
- `resource.ts` - Lambda function resource definition

## Sample Data

### Document Types (4 types)
- **Building Permit Application** - Construction category with architectural requirements
- **Environmental Impact Assessment** - Environment category for development projects
- **Business License Application** - Business category with registration documents
- **Health Department Permit** - Health category for food service and healthcare facilities

### Workflows (2 workflows)
- **Standard Permit Approval Workflow** - Multi-step approval process with dependencies
- **Business Registration Workflow** - Business license approval with verification steps

## Features

### Duplicate Prevention
- Uses conditional expressions to prevent duplicate entries
- Checks for existing records by ID before insertion
- Graceful handling of existing data with skip counting

### Environment Awareness
- Automatically detects environment name from `AWS_BRANCH`
- Uses proper table naming convention: `docflow4-{ResourceType}-{environmentName}`

### Response Format
Returns detailed results including:
- Count of created vs skipped records
- Error details for any failed operations
- CORS headers for frontend access