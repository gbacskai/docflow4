// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Authentication Commands
Cypress.Commands.add('login', (email = 'test@example.com', password = 'TestPassword123!') => {
  cy.visit('/auth');
  cy.get('input[type="email"], input[name="email"], input[placeholder*="email" i]', { timeout: 10000 })
    .should('be.visible')
    .type(email);
  cy.get('input[type="password"], input[name="password"]')
    .should('be.visible')
    .type(password);
  cy.get('button[type="submit"], .sign-in-btn, .btn-primary')
    .should('be.visible')
    .click();
});

Cypress.Commands.add('logout', () => {
  // Try to find and click logout button
  cy.get('body').then(($body) => {
    if ($body.find('[data-cy="logout"], .logout-btn, .sign-out').length > 0) {
      cy.get('[data-cy="logout"], .logout-btn, .sign-out').first().click();
    }
  });
  cy.clearAuthState();
});

// Navigation Commands
Cypress.Commands.add('visitAndWait', (path = '/') => {
  cy.visit(path);
  cy.get('app-root', { timeout: 15000 }).should('exist');
  cy.wait(1000); // Allow Angular to initialize
});

// Form Commands
Cypress.Commands.add('fillForm', (formData) => {
  Object.keys(formData).forEach(field => {
    cy.get(`[name="${field}"], [data-cy="${field}"], #${field}`)
      .should('be.visible')
      .clear()
      .type(formData[field]);
  });
});

// Wait Commands
Cypress.Commands.add('waitForAuth', () => {
  // Wait for authentication state to settle
  cy.wait(2000);
  cy.get('body').should('exist');
});

Cypress.Commands.add('waitForUrl', (expectedUrl, timeout = 10000) => {
  cy.url({ timeout }).should('include', expectedUrl);
});

// Workflow Management Commands
Cypress.Commands.add('selectWorkflow', (workflowName) => {
  cy.get('[data-cy="workflow-selector"], .workflow-select, select[name="workflow"]')
    .should('be.visible')
    .select(workflowName);
});

Cypress.Commands.add('createWorkflow', (workflowData) => {
  cy.get('[data-cy="create-workflow"], .create-workflow-btn, .btn-create')
    .should('be.visible')
    .click();
  cy.fillForm(workflowData);
  cy.get('[data-cy="submit"], button[type="submit"], .btn-submit')
    .should('be.visible')
    .click();
});

// Assertions
Cypress.Commands.add('shouldBeOnPage', (pageName) => {
  cy.url().should('include', pageName.toLowerCase());
  cy.get('body').should('contain.text', pageName);
});

Cypress.Commands.add('shouldHaveContent', (selector, content) => {
  cy.get(selector).should('contain.text', content);
});

// Debug Commands
Cypress.Commands.add('debugAuth', () => {
  cy.window().then((win) => {
    cy.task('log', '🔍 Debug: Current URL = ' + win.location.href);
    cy.task('log', '🔍 Debug: Local Storage = ' + JSON.stringify(win.localStorage));
    cy.task('log', '🔍 Debug: Session Storage = ' + JSON.stringify(win.sessionStorage));
  });
});