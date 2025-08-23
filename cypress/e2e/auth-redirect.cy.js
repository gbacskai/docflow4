describe('Authentication Redirect Tests', () => {
  beforeEach(() => {
    // Clear authentication state before each test
    cy.clearAuthState();
  });

  describe('Unauthenticated User Tests', () => {
    it('should stay on landing page when accessing root URL', () => {
      cy.visitAndWait('/');
      cy.url().should('match', /\/(#\/)?$/);
      
      // Check for landing page content
      cy.get('body').should('contain.text', 'DocFlow')
        .or('contain.text', 'Landing')
        .or('contain.text', 'Welcome');
      
      cy.task('log', '✅ Unauthenticated user stays on landing page');
    });

    it('should display landing page content correctly', () => {
      cy.visitAndWait('/');
      
      // Look for common landing page elements
      cy.get('.landing-page, .hero-section, h1')
        .should('exist');
      
      cy.task('log', '✅ Landing page content is displayed');
    });
  });

  describe('Protected Route Access Tests', () => {
    const protectedRoutes = ['/dashboard', '/projects', '/documents', '/admin'];

    protectedRoutes.forEach(route => {
      it(`should redirect from ${route} to landing page when unauthenticated`, () => {
        cy.visit(route);
        cy.waitForUrl('/', 10000);
        cy.url().should('match', /\/(#\/)?$/);
        
        cy.task('log', `✅ Protected route ${route} redirected to landing page`);
      });
    });
  });

  describe('Authentication Form Tests', () => {
    it('should display authentication form on /auth', () => {
      cy.visit('/auth');
      
      // Check if auth form is present
      cy.get('form, .auth-form, .sign-in-form, input[type="email"]', { timeout: 10000 })
        .should('exist');
      
      cy.task('log', '✅ Authentication form is accessible');
    });

    it('should handle authentication attempt', () => {
      cy.visit('/auth');
      
      // Try to fill authentication form
      cy.get('input[type="email"], input[placeholder*="email" i], input[name="email"]')
        .should('exist')
        .type('test@example.com');
      
      cy.get('input[type="password"], input[name="password"]')
        .should('exist')
        .type('TestPassword123!');
      
      cy.get('button[type="submit"], .sign-in-btn, .btn-primary')
        .should('exist');
      
      cy.task('log', '✅ Authentication form elements are functional');
    });
  });

  describe('Authenticated User Tests', () => {
    beforeEach(() => {
      // Enable test mode for authenticated tests
      cy.visitAndWait('/');
      cy.enableTestMode({
        userId: 'test-user-123',
        username: 'testuser',
        email: 'test@example.com',
        emailVerified: true
      });
      cy.wait(2000); // Allow auth state to settle
    });

    it('should redirect authenticated user from root to dashboard', () => {
      cy.visitAndWait('/');
      
      // Should be redirected to dashboard
      cy.waitForUrl('/dashboard', 15000);
      cy.url().should('include', '/dashboard');
      
      // Check for dashboard content
      cy.get('.dashboard, .dashboard-page, h1, .page-header', { timeout: 10000 })
        .should('exist');
      
      cy.task('log', '✅ Authenticated user redirected to dashboard');
    });

    it('should allow direct access to dashboard when authenticated', () => {
      cy.visitAndWait('/dashboard');
      
      // Should stay on dashboard
      cy.url().should('include', '/dashboard');
      
      cy.task('log', '✅ Authenticated user can access dashboard directly');
    });

    it('should allow access to protected routes when authenticated', () => {
      const protectedRoutes = ['/projects', '/documents'];
      
      protectedRoutes.forEach(route => {
        cy.visitAndWait(route);
        cy.url().should('include', route);
        cy.task('log', `✅ Authenticated user can access ${route}`);
      });
    });

    afterEach(() => {
      // Disable test mode after each authenticated test
      cy.disableTestMode();
    });
  });

  describe('Navigation Guard Integration', () => {
    it('should properly handle auth guard redirections', () => {
      // Test unauthenticated access to protected route
      cy.clearAuthState();
      cy.visit('/dashboard');
      cy.waitForUrl('/', 10000);
      cy.url().should('match', /\/(#\/)?$/);
      
      // Test authenticated access
      cy.enableTestMode();
      cy.wait(2000);
      cy.visit('/');
      cy.waitForUrl('/dashboard', 15000);
      cy.url().should('include', '/dashboard');
      
      cy.task('log', '✅ Navigation guards working correctly');
      
      cy.disableTestMode();
    });
  });
});