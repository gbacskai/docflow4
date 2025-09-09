# Cypress Support Files

This directory contains Cypress support files and custom commands for enhanced testing functionality.

## Purpose
Provides reusable testing utilities, custom commands, and global test configuration for Cypress E2E tests.

## Files
- `commands.js` - Custom Cypress commands and reusable testing utilities
- `e2e.js` - Global test setup, configuration, and initialization code

## Support Functionality

### Custom Commands
Custom Cypress commands that extend testing capabilities:
- Reusable authentication helpers
- Common UI interaction patterns
- Application-specific testing utilities

### Global Setup
- **Test Environment Configuration** - Environment-specific setup for testing
- **Global Before/After Hooks** - Test lifecycle management
- **Error Handling** - Global error handling for test failures

## Usage Pattern
Support files are automatically loaded by Cypress and provide:
- Enhanced testing commands available in all test files
- Consistent test setup across all E2E specifications
- Application-specific testing utilities

## Integration
- **All Test Files** - Support functionality available in all `cypress/e2e/` tests
- **Cypress Framework** - Extends native Cypress functionality
- **Application Testing** - Commands tailored for DocFlow4 application testing

## Related Components
- E2E Tests: `cypress/e2e/` files use these support utilities
- Cypress Config: Configuration in project root `cypress.config.js`
- Test Commands: npm scripts for running Cypress tests