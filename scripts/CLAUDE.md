# Scripts Directory

This directory contains utility scripts for development environment setup and configuration management.

## Purpose
Provides automation scripts for consistent development environment configuration and AWS Amplify setup.

## Key Scripts

### Environment Setup (`setup-env.js`)
- **Purpose**: Configures environment variables for consistent AWS resource naming
- **Branch Detection**: Automatically detects current git branch for environment naming
- **Table Naming**: Ensures consistent naming pattern `docflow4-{ResourceType}-{Branch}`
- **AWS Configuration**: Sets up Amplify-specific environment variables

## Usage Patterns
- **Development Setup**: Run `node scripts/setup-env.js` before Amplify operations
- **Environment Consistency**: Ensures table names match across GraphQL and custom resources
- **Branch-based Development**: Automatic environment naming from git branch

## Integration
- **Amplify Backend** - Works with `amplify/backend.ts` environment detection
- **Table Naming** - Coordinates with custom resource naming in `amplify/custom-resources/`
- **Development Workflow** - Part of local development environment setup

## Related Components
- AWS Backend: Environment variables used in `amplify/backend.ts`
- Custom Resources: Consistent naming with `amplify/custom-resources/all-tables.ts`
- Development Commands: Referenced in main CLAUDE.md development section