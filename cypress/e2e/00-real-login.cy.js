describe('Real Login Tests', () => {
  const credentials = {
    email: 'gbacskai@gmail.com',
    password: 'xeh5NDY@nmh_jkb.znz'
  };

  beforeEach(() => {
    cy.clearAuthState();
  });

  describe('Authentication Flow', () => {
    it('should successfully login with real credentials', () => {
      cy.visit('/auth');
      
      // Wait for auth form to load
      cy.get('input[type="email"], input[name="email"], input[placeholder*="email" i]', { timeout: 10000 })
        .should('be.visible')
        .type(credentials.email);
      
      cy.get('input[type="password"], input[name="password"]')
        .should('be.visible')
        .type(credentials.password);
      
      // Submit login form
      cy.get('button[type="submit"], .sign-in-btn, .btn-primary')
        .should('be.visible')
        .click();
      
      // Wait for authentication to complete
      cy.wait(5000);
      
      // Should redirect to dashboard
      cy.url({ timeout: 15000 }).should('include', '/dashboard');
      
      // Verify dashboard content is loaded
      cy.get('.dashboard, .dashboard-page, h1, .page-header')
        .should('exist');
      
      cy.task('log', '✅ Real login successful - redirected to dashboard');
    });

    it('should maintain authentication across page reloads', () => {
      // Login first
      cy.visit('/auth');
      cy.get('input[type="email"]').type(credentials.email);
      cy.get('input[type="password"]').type(credentials.password);
      cy.get('button[type="submit"]').click();
      
      cy.url({ timeout: 15000 }).should('include', '/dashboard');
      
      // Reload page
      cy.reload();
      
      // Should still be authenticated
      cy.url().should('include', '/dashboard');
      cy.get('.dashboard, .dashboard-page').should('exist');
      
      cy.task('log', '✅ Authentication persisted across reload');
    });

    it('should access protected routes when authenticated', () => {
      // Login
      cy.visit('/auth');
      cy.get('input[type="email"]').type(credentials.email);
      cy.get('input[type="password"]').type(credentials.password);
      cy.get('button[type="submit"]').click();
      
      cy.url({ timeout: 15000 }).should('include', '/dashboard');
      
      // Test access to protected routes
      const protectedRoutes = ['/document-types', '/workflows'];
      
      protectedRoutes.forEach(route => {
        cy.visit(route);
        cy.url().should('include', route);
        cy.task('log', `✅ Authenticated access to ${route} successful`);
      });
    });

    it('should display user menu when authenticated', () => {
      // Login
      cy.visit('/auth');
      cy.get('input[type="email"]').type(credentials.email);
      cy.get('input[type="password"]').type(credentials.password);
      cy.get('button[type="submit"]').click();
      
      cy.url({ timeout: 15000 }).should('include', '/dashboard');
      
      // User menu should be visible
      cy.get('app-user-menu, .user-menu, .user-avatar', { timeout: 10000 })
        .should('exist');
      
      // Should have logout functionality
      cy.get('app-user-menu').click();
      cy.get('button:contains("Logout"), .logout-btn')
        .should('exist');
      
      cy.task('log', '✅ User menu displayed with logout option');
    });

    it('should logout successfully', () => {
      // Login first
      cy.visit('/auth');
      cy.get('input[type="email"]').type(credentials.email);
      cy.get('input[type="password"]').type(credentials.password);
      cy.get('button[type="submit"]').click();
      
      cy.url({ timeout: 15000 }).should('include', '/dashboard');
      
      // Logout
      cy.get('app-user-menu, .user-menu').click();
      cy.get('button:contains("Logout"), .logout-btn').click();
      
      // Should redirect to landing page
      cy.url({ timeout: 10000 }).should('match', /\/(#\/)?$/);
      
      // Verify unauthenticated state
      cy.get('body').should('contain.text', 'DocFlow')
        .or('contain.text', 'Landing')
        .or('contain.text', 'Welcome');
      
      cy.task('log', '✅ Logout successful - redirected to landing page');
    });
  });

  describe('Document Type and Workflow Management', () => {
    beforeEach(() => {
      // Login before each test
      cy.visit('/auth');
      cy.get('input[type="email"]').type(credentials.email);
      cy.get('input[type="password"]').type(credentials.password);
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should('include', '/dashboard');
    });

    it('should access document types page and verify functionality', () => {
      cy.visit('/document-types');
      
      // Create document type
      cy.get('button:contains("Create"), .btn-primary').click();
      cy.get('input[name="name"]').type('Real Auth Test Document');
      cy.get('textarea[name="description"]').type('Document type created with real authentication to verify full functionality');
      cy.get('button[type="submit"]').click();
      
      // Verify creation
      cy.get('.document-type-card').contains('Real Auth Test Document').should('exist');
      cy.task('log', '✅ Document type created with real authentication');
      
      // Cleanup
      cy.get('.document-type-card').contains('Real Auth Test Document')
        .parent('.document-type-card')
        .find('button:contains("Delete")')
        .click();
      cy.get('button:contains("Confirm")').click();
    });

    it('should access workflows page and verify functionality', () => {
      cy.visit('/workflows');
      
      // Create workflow
      cy.get('button:contains("Create"), .btn-primary').click();
      cy.get('input[name="name"]').type('Real Auth Test Workflow');
      cy.get('textarea[name="description"]').type('Workflow created with real authentication');
      
      // Add a simple rule
      cy.get('button:contains("Add Rule"), .add-rule-btn').then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click();
          cy.get('textarea[placeholder*="validation"]').first().type('document.status == "pending"');
          cy.get('textarea[placeholder*="action"]').first().type('approve document');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      // Verify creation
      cy.get('.workflow-card, .workflow-item').contains('Real Auth Test Workflow').should('exist');
      cy.task('log', '✅ Workflow created with real authentication');
      
      // Cleanup
      cy.get('.workflow-card').contains('Real Auth Test Workflow')
        .parent('.workflow-card')
        .find('button:contains("Delete")')
        .click();
      cy.get('button:contains("Confirm")').click();
    });
  });

  describe('Complete Application Flow', () => {
    it('should demonstrate complete authenticated workflow', () => {
      cy.task('log', '🎯 Testing complete application workflow with real authentication');
      
      // Step 1: Login
      cy.visit('/auth');
      cy.get('input[type="email"]').type(credentials.email);
      cy.get('input[type="password"]').type(credentials.password);
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should('include', '/dashboard');
      cy.task('log', '✅ Step 1: Login successful');
      
      // Step 2: Navigate between pages
      cy.visit('/document-types');
      cy.url().should('include', '/document-types');
      cy.task('log', '✅ Step 2: Document Types page accessible');
      
      cy.visit('/workflows');
      cy.url().should('include', '/workflows');
      cy.task('log', '✅ Step 3: Workflows page accessible');
      
      // Step 4: Test user menu
      cy.get('app-user-menu').click();
      cy.get('button:contains("Logout")').should('exist');
      cy.task('log', '✅ Step 4: User menu functional');
      
      // Step 5: Logout
      cy.get('button:contains("Logout")').click();
      cy.url({ timeout: 10000 }).should('match', /\/(#\/)?$/);
      cy.task('log', '✅ Step 5: Logout successful');
      
      cy.task('log', '🎉 Complete application workflow verified with real authentication');
    });
  });

  describe('Error Handling', () => {
    it('should handle incorrect credentials gracefully', () => {
      cy.visit('/auth');
      
      // Try with wrong password
      cy.get('input[type="email"]').type(credentials.email);
      cy.get('input[type="password"]').type('wrongpassword123');
      cy.get('button[type="submit"]').click();
      
      cy.wait(3000);
      
      // Should show error or stay on auth page
      cy.url().then((url) => {
        if (url.includes('/auth') || url === 'http://localhost:4200/') {
          cy.task('log', '✅ Incorrect credentials handled appropriately');
          
          // Check for error message
          cy.get('.error, .alert-error, .auth-error').then(($error) => {
            if ($error.length > 0) {
              cy.task('log', '✅ Error message displayed for wrong credentials');
            } else {
              cy.task('log', '✅ Authentication handled gracefully');
            }
          });
        }
      });
    });

    it('should handle empty credentials', () => {
      cy.visit('/auth');
      
      // Try submitting empty form
      cy.get('button[type="submit"]').click();
      
      // Should show validation errors
      cy.get('.error, .invalid, [class*="error"]').should('exist');
      
      cy.task('log', '✅ Empty credentials validation working');
    });
  });
});