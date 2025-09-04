# Cypress E2E Tests

This directory contains Cypress end-to-end test specifications for browser automation testing.

## Purpose
Houses actual test files that simulate real user interactions with the DocFlow4 application in a browser environment.

## Files
- `00-real-login.cy.js` - Comprehensive authentication and feature testing with real login credentials

## Test Coverage

### Authentication Flow Testing
- **Real Login Process** - Uses actual user credentials (gbacskai@gmail.com)
- **Authentication Guards** - Validates route protection and access control
- **Logout Functionality** - Tests complete authentication lifecycle

### Feature Integration Testing
- **Document Type Management** - Tests document type creation and management functionality
- **Workflow Operations** - Validates workflow management features
- **User Interface Testing** - Tests complete user interaction flows

## Test Characteristics
- **Real Backend Integration** - Tests against actual AWS Amplify backend services
- **Browser Simulation** - True browser environment testing with DOM interaction
- **Screenshot Capture** - Automatic failure screenshot capture for debugging

## Credentials Used
- **Admin User**: gbacskai@gmail.com (for admin feature testing)
- **Test Password**: Configured in test environment
- **Real Authentication** - Uses actual Cognito authentication flow

## Related Components
- All frontend components are tested through user interaction simulation
- Authentication flow covers `auth/`, `landing/`, `dashboard/` components
- Feature testing validates `document-types/`, `workflows/` functionality