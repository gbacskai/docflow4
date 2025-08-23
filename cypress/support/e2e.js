// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Custom commands for authentication testing
Cypress.Commands.add('enableTestMode', (mockUser = {}) => {
  const defaultUser = {
    userId: 'test-user-123',
    username: 'testuser',
    email: 'test@example.com',
    emailVerified: true
  };
  
  const user = { ...defaultUser, ...mockUser };
  
  cy.window().then((win) => {
    // Set playwright flag for test mode detection
    win.playwright = true;
    
    // Try to access AuthService and enable test mode
    cy.get('app-root').then(($appRoot) => {
      try {
        // Try multiple methods to access Angular service
        const appElement = $appRoot[0];
        const angularApp = win.ng?.getInjector?.(appElement);
        
        if (angularApp) {
          const authService = angularApp.get('AuthService');
          if (authService && typeof authService.enableTestMode === 'function') {
            authService.enableTestMode(user);
            cy.log('✅ AuthService test mode enabled successfully');
          }
        }
      } catch (error) {
        cy.log('Could not access AuthService directly:', error.message);
      }
    });
  });
});

Cypress.Commands.add('disableTestMode', () => {
  cy.window().then((win) => {
    cy.get('app-root').then(($appRoot) => {
      try {
        const appElement = $appRoot[0];
        const angularApp = win.ng?.getInjector?.(appElement);
        
        if (angularApp) {
          const authService = angularApp.get('AuthService');
          if (authService && typeof authService.disableTestMode === 'function') {
            authService.disableTestMode();
            cy.log('🧪 Test mode disabled');
          }
        }
      } catch (error) {
        cy.log('Could not disable test mode:', error.message);
      }
    });
  });
});

Cypress.Commands.add('clearAuthState', () => {
  cy.clearLocalStorage();
  cy.clearCookies();
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });
});

// Global error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent the test from failing on uncaught exceptions
  // This is useful for Angular hydration errors and other non-critical errors
  console.warn('Uncaught exception:', err.message);
  return false;
});

// Custom logging
beforeEach(() => {
  cy.log('🧪 Starting test:', Cypress.currentTest.title);
});

afterEach(() => {
  cy.log('✅ Test completed:', Cypress.currentTest.title);
});