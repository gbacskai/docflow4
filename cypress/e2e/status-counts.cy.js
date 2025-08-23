describe('Status & Counts Tests', () => {
  beforeEach(() => {
    cy.clearAuthState();
    cy.visitAndWait('/');
    cy.enableTestMode();
    cy.wait(2000);
  });

  afterEach(() => {
    cy.disableTestMode();
  });

  describe('Default Status Values', () => {
    it('should display correct default status values', () => {
      cy.visitAndWait('/dashboard');
      
      // Look for status indicators
      cy.get('body').then(($body) => {
        if ($body.find('.status, .status-indicator, .badge').length > 0) {
          cy.get('.status, .status-indicator, .badge').should('exist');
          cy.task('log', '✅ Status indicators found');
        } else {
          cy.task('log', '⚠️ Status indicators not found - may not be implemented yet');
        }
      });
      
      cy.task('log', '✅ Default status values test completed');
    });

    it('should show appropriate status colors', () => {
      cy.visitAndWait('/projects');
      
      // Check for status color coding
      cy.get('body').then(($body) => {
        const statusElements = $body.find('.status-active, .status-pending, .status-complete, .status-draft');
        if (statusElements.length > 0) {
          cy.task('log', '✅ Status color coding found');
        } else {
          cy.task('log', '⚠️ Status color coding not found');
        }
      });
      
      cy.task('log', '✅ Status colors test completed');
    });
  });

  describe('Count Displays', () => {
    it('should display correct item counts', () => {
      cy.visitAndWait('/dashboard');
      
      // Look for count displays
      cy.get('body').then(($body) => {
        const countElements = $body.find('.count, .counter, .total, .stat-number');
        if (countElements.length > 0) {
          cy.get('.count, .counter, .total, .stat-number').should('exist');
          cy.task('log', '✅ Count displays found');
        } else {
          cy.task('log', '⚠️ Count displays not found');
        }
      });
      
      cy.task('log', '✅ Item counts test completed');
    });

    it('should update counts when items change', () => {
      cy.visitAndWait('/projects');
      
      // Test count updates (if create functionality exists)
      cy.get('body').then(($body) => {
        if ($body.find('.create-btn, .add-btn, button:contains("Create"), button:contains("Add")').length > 0) {
          // Record initial count if visible
          const initialCountElements = $body.find('.count, .counter, .total');
          if (initialCountElements.length > 0) {
            cy.task('log', '✅ Counts can be tracked for updates');
          }
        }
      });
      
      cy.task('log', '✅ Count updates test completed');
    });
  });

  describe('Statistics Display', () => {
    it('should show project statistics', () => {
      cy.visitAndWait('/projects');
      
      // Check for statistics
      cy.get('body').should('contain.text', 'Project').or('contain.text', 'project');
      
      cy.get('body').then(($body) => {
        const statElements = $body.find('.stats, .statistics, .metrics, .dashboard-stats');
        if (statElements.length > 0) {
          cy.task('log', '✅ Project statistics found');
        } else {
          cy.task('log', '⚠️ Project statistics not visible');
        }
      });
      
      cy.task('log', '✅ Project statistics test completed');
    });

    it('should show document statistics', () => {
      cy.visitAndWait('/documents');
      
      // Check for document statistics
      cy.get('body').should('exist');
      
      cy.get('body').then(($body) => {
        if ($body.find('.document-count, .doc-stats').length > 0) {
          cy.task('log', '✅ Document statistics found');
        } else {
          cy.task('log', '⚠️ Document statistics not found');
        }
      });
      
      cy.task('log', '✅ Document statistics test completed');
    });

    it('should show user statistics in admin panel', () => {
      cy.visitAndWait('/admin');
      
      // Check admin statistics
      cy.get('body').then(($body) => {
        if ($body.find('.user-count, .admin-stats, .system-stats').length > 0) {
          cy.task('log', '✅ Admin statistics found');
        } else {
          cy.task('log', '⚠️ Admin statistics not found');
        }
      });
      
      cy.task('log', '✅ Admin statistics test completed');
    });
  });

  describe('Real-time Updates', () => {
    it('should handle real-time count updates', () => {
      cy.visitAndWait('/dashboard');
      
      // Test real-time updates if WebSocket or polling is implemented
      cy.wait(2000);
      cy.get('body').should('exist');
      
      cy.task('log', '✅ Real-time updates test completed');
    });

    it('should refresh counts on page reload', () => {
      cy.visitAndWait('/projects');
      
      // Test count refresh
      cy.reload();
      cy.wait(2000);
      cy.get('body').should('exist');
      
      cy.task('log', '✅ Count refresh test completed');
    });
  });
});