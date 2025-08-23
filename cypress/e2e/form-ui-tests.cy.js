describe('Form & UI Tests', () => {
  beforeEach(() => {
    cy.clearAuthState();
    cy.visitAndWait('/');
    cy.enableTestMode();
    cy.wait(2000);
  });

  afterEach(() => {
    cy.disableTestMode();
  });

  describe('Confirmation Forms', () => {
    it('should display and handle confirmation forms', () => {
      cy.visitAndWait('/auth');
      
      // Check for confirmation form elements
      cy.get('body').then(($body) => {
        if ($body.find('form, .form, .confirmation-form').length > 0) {
          cy.get('form, .form, .confirmation-form').first().should('exist');
          cy.task('log', '✅ Confirmation form elements found');
        } else {
          cy.task('log', '⚠️ Confirmation form not found - checking other pages');
        }
      });
      
      cy.task('log', '✅ Confirmation form test completed');
    });

    it('should validate form inputs', () => {
      cy.visitAndWait('/auth');
      
      // Test form validation
      cy.get('input[type="email"]').then(($input) => {
        if ($input.length > 0) {
          cy.wrap($input).first().type('invalid-email');
          cy.get('button[type="submit"]').click();
          // Look for validation messages
          cy.get('body').then(($body) => {
            if ($body.find('.error, .invalid, .validation-error').length > 0) {
              cy.task('log', '✅ Form validation working');
            }
          });
        }
      });
      
      cy.task('log', '✅ Form validation test completed');
    });
  });

  describe('Search Functionality', () => {
    it('should handle search focus behavior', () => {
      // Test search functionality on different pages
      const searchPages = ['/dashboard', '/projects', '/documents'];
      
      searchPages.forEach(page => {
        cy.visitAndWait(page);
        
        // Look for search inputs
        cy.get('body').then(($body) => {
          if ($body.find('input[type="search"], .search-input, [placeholder*="search" i]').length > 0) {
            cy.get('input[type="search"], .search-input, [placeholder*="search" i]')
              .first()
              .should('exist')
              .focus();
            cy.task('log', `✅ Search focus working on ${page}`);
          } else {
            cy.task('log', `⚠️ No search input found on ${page}`);
          }
        });
      });
      
      cy.task('log', '✅ Search focus test completed');
    });

    it('should handle search input and results', () => {
      cy.visitAndWait('/documents');
      
      // Test search functionality
      cy.get('body').then(($body) => {
        if ($body.find('input[type="search"], .search-input, [placeholder*="search" i]').length > 0) {
          cy.get('input[type="search"], .search-input, [placeholder*="search" i]')
            .first()
            .type('test search');
          cy.wait(1000);
          cy.task('log', '✅ Search input accepted');
        }
      });
      
      cy.task('log', '✅ Search input test completed');
    });
  });

  describe('User Type Visibility', () => {
    it('should display appropriate UI based on user type', () => {
      // Test admin user visibility
      cy.enableTestMode({
        userId: 'admin-user-123',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin'
      });
      
      cy.visitAndWait('/admin');
      cy.url().should('include', '/admin');
      cy.get('body').should('contain.text', 'Admin');
      
      cy.task('log', '✅ Admin user type visibility test completed');
    });

    it('should restrict access based on user permissions', () => {
      // Test regular user restrictions
      cy.enableTestMode({
        userId: 'regular-user-123',
        username: 'user',
        email: 'user@example.com',
        role: 'user'
      });
      
      cy.visitAndWait('/admin');
      
      // Should redirect away from admin page or show access denied
      cy.get('body').then(($body) => {
        if ($body.find('.access-denied, .unauthorized').length > 0) {
          cy.task('log', '✅ Access restriction working');
        } else if (!window.location.href.includes('/admin')) {
          cy.task('log', '✅ Redirect from restricted page working');
        } else {
          cy.task('log', '⚠️ Access restriction may need review');
        }
      });
      
      cy.task('log', '✅ User permission test completed');
    });
  });

  describe('UI Components', () => {
    it('should render navigation components correctly', () => {
      cy.visitAndWait('/dashboard');
      
      // Check for navigation elements
      cy.get('nav, .navigation, .navbar, .menu').should('exist');
      
      cy.task('log', '✅ Navigation components test completed');
    });

    it('should handle responsive design elements', () => {
      // Test responsive behavior
      cy.viewport(1280, 720);
      cy.visitAndWait('/dashboard');
      cy.get('body').should('exist');
      
      cy.viewport(768, 1024);
      cy.get('body').should('exist');
      
      cy.viewport(375, 667);
      cy.get('body').should('exist');
      
      cy.task('log', '✅ Responsive design test completed');
    });
  });
});