# Test Scripts

This directory contains all test scripts for the DocFlow4 application.

## User Type Visibility Tests

### `test-headless-user-type.js`
**Main headless test for user type visibility**
- Automated Puppeteer-based test
- Tests that user type fields are hidden from non-admin users
- Includes login, navigation, and comprehensive UI testing
- Generates screenshots for debugging

**Usage:**
```bash
cd tests
node test-headless-user-type.js
```

**Requirements:**
- Angular app running on `http://localhost:4200`
- Puppeteer installed (`npm install puppeteer`)

### `run-headless-test.sh`
**Test runner script**
- Installs Puppeteer if needed
- Checks if Angular app is running
- Runs the headless test automatically

**Usage:**
```bash
cd tests
./run-headless-test.sh
```

### `manual-user-type-test.js`
**Manual browser console test functions**
- Simple functions to run in browser developer console
- Quick verification of user type visibility
- Good for interactive testing during development

**Usage:**
1. Sign in with test user: `gergo@xshopper.com` / `jvw_zpd3JRF@qfn811byc`
2. Navigate to Users page
3. Open browser console and paste the script
4. Run individual test functions

### `test-user-type-visibility.js`
**Comprehensive automated test suite**
- Full-featured test with login simulation
- More detailed than the headless version
- Includes manual testing guidance

## Other Test Scripts

### Domain-related Tests
- `test-domain-change.js` - Tests domain change functionality
- `test-domain-lifecycle.js` - Tests domain lifecycle management
- `test-domain-selection.js` - Tests domain selection UI
- `test-domain-selection-simple.js` - Simplified domain selection test
- `test-domain-update-fix.js` - Tests domain update fixes
- `test-headless-domain-selection.js` - Headless domain selection test
- `test-optional-domains.js` - Tests optional domain functionality

### Authentication Tests
- `test-auth-implementation.js` - Tests authentication implementation
- `test-confirmation-form.js` - Tests confirmation form functionality
- `test-headless-with-auth.js` - Headless test with authentication

### UI Behavior Tests
- `test-manual-behavior.js` - Manual UI behavior testing
- `test-search-focus.js` - Tests search input focus behavior
- `test-default-status-and-counts.js` - Tests default status and counts

### Demo Tests
- `test-headless-demo.js` - Demo headless testing

## Test Credentials

**Non-Admin Test User:**
- Email: `gergo@xshopper.com`
- Password: `jvw_zpd3JRF@qfn811byc`
- Expected: User type fields should NOT be visible

## Running Tests

### Prerequisites
1. Start the Angular development server:
   ```bash
   npm start
   # or
   ng serve
   ```

2. Ensure the app is accessible at `http://localhost:4200`

### Run Headless User Type Test
```bash
cd tests
./run-headless-test.sh
```

### Run Manual Tests
1. Open browser to `http://localhost:4200`
2. Sign in with test credentials
3. Navigate to Users page
4. Open Developer Tools (F12) → Console
5. Load and run test scripts

## Expected Results

For non-admin users, all tests should verify:
- ✅ User type badges are NOT visible in Users list
- ✅ User type dropdown is NOT present in Edit forms
- ✅ User type information is NOT displayed in View mode
- ✅ Current user is correctly identified as non-admin

## Troubleshooting

### Common Issues
1. **"Angular app not running"**: Start the app with `npm start`
2. **"Puppeteer not found"**: Run `npm install puppeteer`
3. **Login fails**: Verify test credentials are correct
4. **Navigation timeout**: App might be slow to load, increase timeouts

### Debug Screenshots
Headless tests automatically generate screenshots in the project root:
- `test-screenshot-after-login-*.png`
- `test-screenshot-users-page-*.png`
- `test-screenshot-tests-completed-*.png`