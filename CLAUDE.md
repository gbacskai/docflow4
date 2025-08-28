# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- **Start development server**: `npm start` or `ng serve` - serves at http://localhost:4200/
- **Build for production**: `npm run build` or `ng build`
- **Build with watch**: `npm run watch` - development build with file watching
- **Generate components**: `ng generate component component-name`

### AWS Amplify Setup
- **Generate amplify outputs**: `npm ampx generate outputs` - creates amplify_outputs.json
- **Create sandbox environment**: `npx ampx sandbox --profile aws_amplify_permithunter --identifier 00003`

### Testing Commands
- **Run unit tests**: `npm test` or `ng test` - runs Karma/Jasmine tests
- **Run single test file**: `ng test --include="src/path/to/test.spec.ts" --browsers=ChromeHeadless --watch=false`
- **Run headless unit tests**: `npm run test:headless` - runs tests without browser UI
- **Run CI tests**: `npm run test:ci-smart` - intelligent CI test runner with Chrome detection
- **Run coverage**: `npm run test:coverage` - generates code coverage report
- **Run E2E tests**: `npm run test:e2e` - full E2E test suite with Cypress and Node.js tests
- **Run Cypress tests**: `npm run test:cypress` - Cypress browser tests only
- **Run Node.js integration tests**: `npm run test:node-scripts` - custom test scripts
- **Generate test report**: `npm run test:report` - generates comprehensive test report

### CSS Management
- **CSS optimization**: `npm run css:optimize` and `npm run css:restore` for CSS management
- **Analyze CSS**: `npm run css:analyze` - analyze CSS bundle sizes
- **Purge CSS**: `npm run purge:css` - remove unused CSS from production build

## Project Architecture

This is a document flow management application built with Angular 20 and AWS Amplify:

- **Angular 20.2.0** with standalone components architecture
- **AWS Amplify v6** for backend services (auth, data, storage)
- **TypeScript** with strict configuration enabled
- **LESS** preprocessor for styling
- **Signal-based state management** throughout the application
- **Comprehensive testing** with Karma/Jasmine, Cypress, and Node.js integration tests

### AWS Amplify Integration

The application uses AWS Amplify v6 with the following backend resources:
- **Authentication**: Cognito-based user management with sign up/in/out
- **Data**: GraphQL API with domain, document, and user management
- **Storage**: S3-based file storage for document uploads

Key AWS integration patterns:
- Import AWS services directly from `aws-amplify/auth`, `aws-amplify/data`, `aws-amplify/storage`
- Use `generateClient()` from `aws-amplify/data` for GraphQL operations
- Service layer abstracts AWS operations (`auth.service.ts`, `admin.service.ts`, `user-data.service.ts`)

### Application Structure

The app follows a feature-based architecture with guard-protected routes:

**Core Components:**
- `Landing` - Landing page with conditional redirect logic
- `Auth` - Authentication forms (sign in/up/confirm)
- `Dashboard` - Main authenticated user dashboard
- `Admin` - Administrative interface (admin users only)

**Feature Components:**
- `Domains` - Domain management (CRUD operations)
- `DocumentTypes` - Document type configuration
- `Documents` - Document management and file operations
- `Projects` - Project organization
- `Users` - User management (admin feature)
- `MyAccount` - User profile management

**Services:**
- `AuthService` - Authentication state and operations
- `AdminService` - Administrative functions and user management
- `UserDataService` - User profile data operations
- `UserManagementService` - User CRUD operations
- `ChatService` - Real-time chat functionality with DynamoDB tables

### Key Component Patterns

**DocumentTypes Domain Selection Workflow:**
The DocumentTypes component uses a complex temporary domain selection system:
1. `openDomainSidebar()` - Initializes `tempSelectedDomains` signal with current form values
2. `toggleDomainInSidebar()` - Modifies temporary selection (adds/removes domains)
3. `applyDomainSelection()` - Commits temporary selection to form via `patchValue()`
4. Domain selection state flows: Form → Temp Selection → Form (via user confirmation)

### Routing and Guards

Uses functional guards for route protection:
- `authGuard` - Requires authentication
- `adminGuard` - Requires admin privileges
- `landingGuard` - Smart landing page routing

### Signal-Based State Management

All components use Angular signals for reactive state:
```typescript
private _currentUser = signal<AuthUser | null>(null);
currentUser = this._currentUser.asReadonly();
```

### Testing Architecture

**Multi-layered testing approach:**
1. **Angular Unit Tests** - Karma/Jasmine for component testing
2. **Node.js Integration Tests** - Custom test scripts in `/tests` directory
3. **Cypress E2E Tests** - Browser automation testing
4. **CI/CD Testing** - Intelligent test runner with environment detection

**Key Testing Files:**
- `karma.conf.js` - Configured for multiple browser environments (Chrome, ChromeHeadless, ChromeCI)
- `run-ci-tests.js` - Intelligent CI runner that detects Chrome availability
- `generate-test-report.js` - Unified test report generation
- `src/test-helpers.ts` - Centralized test utilities with AWS service mocking

**AWS Amplify Testing Patterns:**
Since AWS Amplify uses ES modules that cannot be easily mocked, use component method overriding:

```typescript
// In beforeEach(fakeAsync(() => {...})):
const mockClient = {
  models: {
    Domain: {
      list: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockData })),
      create: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockData[0] })),
      update: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockData[0] })),
      delete: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockData[0] }))
    }
  }
};

// Override component methods to use mock client
spyOn(component, 'loadDomains').and.callFake(async () => {
  component.loading.set(true);
  const { data } = await mockClient.models.Domain.list();
  component.domains.set(data);
  component.loading.set(false);
});
```

**Test User Credentials:**
- **Admin user**: gbacskai@gmail.com / jvw_zpd3JRF@qfn8byc (use for domain/document type tests)
- **Normal user**: gergo@xshopper.com / jvw_zpd3JRF@qfn811byc

**Critical Testing Requirements:**
- Use `fakeAsync(() => {...})` for beforeEach and test functions
- Always call `tick()` after async operations and form updates
- Use TestHelpers.configureTestingModule() for consistent service mocking
- For DocumentTypes tests: call `component.openDomainSidebar()` before domain toggles, then `component.applyDomainSelection()` to update forms

### Code Style and Configuration

- **TypeScript**: Strict mode with additional strict options (noImplicitReturns, noFallthroughCasesInSwitch)
- **Prettier**: 100 character line width, single quotes, Angular HTML parser
- **LESS**: Component-level styling with global styles in `src/styles.less`
- **Build budgets**: Production builds monitored for size (2MB initial, 50kB component styles)

### AWS Amplify Deployment

- **Backend**: Defined in `amplify/backend.ts` with auth, data, and storage resources
- **Frontend**: Deployed via `amplify.yml` with comprehensive test pipeline
- **Environment**: Node.js 24.5.0 with npm caching optimization
- **Testing in CI**: Multi-stage testing including unit tests, E2E tests, and custom Node.js tests

**AWS Build Environment Compatibility:**
- Test scripts auto-detect project root to work in both local and AWS CodeBuild environments
- AWS CodeBuild paths like `/codebuild/output/src*/src/dockflow4` are handled automatically
- No hardcoded paths in test files for maximum portability