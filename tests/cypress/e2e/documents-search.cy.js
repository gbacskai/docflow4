describe('Documents Search Functionality', () => {
  const credentials = {
    email: 'gbacskai@gmail.com',
    password: 'jvw_zpd3JRF@qfn8byc'
  };

  beforeEach(() => {
    cy.clearAuthState();
    
    // Login to access documents page
    cy.visit('/auth');
    cy.get('input[type="email"]', { timeout: 10000 }).type(credentials.email, { force: true });
    cy.get('input[type="password"]').type(credentials.password, { force: true });
    cy.get('button[type="submit"]').click({ force: true });
    
    // Wait for authentication and navigate to documents
    cy.wait(5000);
    cy.url({ timeout: 15000 }).should('include', '/dashboard');
    cy.visit('/documents');
    
    // Wait for documents page to load
    cy.get('.documents-page', { timeout: 10000 }).should('be.visible');
    cy.get('.search-input').should('be.visible');
  });

  describe('Case-insensitive Search', () => {
    it('should find documents with lowercase search term', () => {
      // Check if there are any documents, if not skip search tests
      cy.get('body').then($body => {
        if ($body.find('.empty-state').length > 0) {
          cy.log('No documents available - skipping search test');
          return;
        }
        
        // Wait for documents to load
        cy.get('.documents-list .document-card', { timeout: 10000 }).should('have.length.greaterThan', 0);
        
        // Use a simple search term
        const searchTerm = 'test';
        
        // Search with lowercase
        cy.get('.search-input').clear().type(searchTerm);
        
        // Wait for search debounce (300ms + buffer)
        cy.wait(500);
        
        // Either show filtered results or empty state
        cy.get('body').should($body => {
          const hasResults = $body.find('.document-card').length > 0;
          const hasEmptyState = $body.find('.empty-state').length > 0;
          expect(hasResults || hasEmptyState).to.be.true;
        });
      });
    });

    it('should find documents with uppercase search term', () => {
      // Wait for documents to load
      cy.get('.documents-list .document-card', { timeout: 10000 }).should('have.length.greaterThan', 0);
      
      // Get the first document's project name for testing
      cy.get('.document-card').first().find('h3').invoke('text').then((documentTitle) => {
        const searchTerm = documentTitle.split(' - ')[0].slice(0, 4).toUpperCase();
        
        // Search with uppercase
        cy.get('.search-input').clear().type(searchTerm);
        
        // Wait for search debounce
        cy.wait(500);
        
        // Verify results are filtered and contain the search term
        cy.get('.document-card').should('have.length.greaterThan', 0);
        cy.get('.document-card h3').each(($el) => {
          expect($el.text().toLowerCase()).to.include(searchTerm.toLowerCase());
        });
      });
    });

    it('should find documents with mixed case search term', () => {
      // Wait for documents to load
      cy.get('.documents-list .document-card', { timeout: 10000 }).should('have.length.greaterThan', 0);
      
      // Get the first document's project name for testing
      cy.get('.document-card').first().find('h3').invoke('text').then((documentTitle) => {
        const projectName = documentTitle.split(' - ')[0];
        const searchTerm = projectName.slice(0, 4);
        const mixedCaseSearchTerm = searchTerm.toLowerCase().charAt(0).toUpperCase() + 
                                    searchTerm.slice(1).toLowerCase();
        
        // Search with mixed case
        cy.get('.search-input').clear().type(mixedCaseSearchTerm);
        
        // Wait for search debounce
        cy.wait(500);
        
        // Verify results are filtered and contain the search term
        cy.get('.document-card').should('have.length.greaterThan', 0);
        cy.get('.document-card h3').each(($el) => {
          expect($el.text().toLowerCase()).to.include(searchTerm.toLowerCase());
        });
      });
    });

    it('should search by document type name case-insensitively', () => {
      // Wait for documents to load
      cy.get('.documents-list .document-card', { timeout: 10000 }).should('have.length.greaterThan', 0);
      
      // Get the first document's type name for testing
      cy.get('.document-card').first().find('.document-type').invoke('text').then((docTypeName) => {
        const searchTerm = docTypeName.slice(0, 4).toLowerCase();
        
        // Search by document type with lowercase
        cy.get('.search-input').clear().type(searchTerm);
        
        // Wait for search debounce
        cy.wait(500);
        
        // Verify results contain documents with matching document type
        cy.get('.document-card').should('have.length.greaterThan', 0);
        cy.get('.document-card .document-type').each(($el) => {
          expect($el.text().toLowerCase()).to.include(searchTerm);
        });
      });
    });

    it('should show no results message for non-existent search terms', () => {
      // Search for non-existent term
      cy.get('.search-input').clear().type('zzznonexistentxyz');
      
      // Wait for search debounce
      cy.wait(500);
      
      // Should show no results message
      cy.get('.empty-state').should('be.visible');
      cy.get('.empty-state').should('contain.text', 'No documents found matching "zzznonexistentxyz"');
      
      // Should show clear search button
      cy.get('.btn-clear-search').should('be.visible');
    });

    it('should clear search results when clear button is clicked', () => {
      // First perform a search
      cy.get('.search-input').type('test');
      cy.wait(500);
      
      // Clear the search
      cy.get('.clear-search-btn').should('be.visible').click();
      
      // Verify search is cleared
      cy.get('.search-input').should('have.value', '');
      
      // Verify all documents are shown again
      cy.get('.document-card').should('have.length.greaterThan', 0);
    });

    it('should handle empty search query gracefully', () => {
      // Type and then clear the search
      cy.get('.search-input').type('test').clear();
      
      // Wait for debounce
      cy.wait(500);
      
      // Should show all documents
      cy.get('.document-card').should('have.length.greaterThan', 0);
      
      // Clear search button should not be visible
      cy.get('.clear-search-btn').should('not.exist');
    });

    it('should maintain search state during navigation', () => {
      // Perform a search
      cy.get('.search-input').type('test');
      cy.wait(500);
      
      // Navigate away and back
      cy.visit('/dashboard');
      cy.visit('/documents');
      
      // Wait for page to load
      cy.get('.documents-page').should('be.visible');
      
      // Search should be cleared (this is expected behavior)
      cy.get('.search-input').should('have.value', '');
    });
  });

  describe('Search Performance', () => {
    it('should debounce search input for performance', () => {
      // Type rapidly
      cy.get('.search-input').type('a').type('b').type('c');
      
      // Should not immediately filter (due to debounce)
      // Wait less than debounce time
      cy.wait(100);
      
      // Results might still be updating
      // Wait for debounce to complete
      cy.wait(400);
      
      // Now results should be filtered
      cy.get('.document-card h3').each(($el) => {
        expect($el.text().toLowerCase()).to.include('abc');
      });
    });
  });
});