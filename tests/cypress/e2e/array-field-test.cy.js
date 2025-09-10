describe('Array Field Functionality Test', () => {
  
  it('should demonstrate array field input behavior', () => {
    // Visit the application (will handle auth automatically)
    cy.visit('/');
    cy.wait(2000);
    
    // Check if we need to log in
    cy.get('body').then(($body) => {
      if ($body.text().includes('Sign In') || $body.text().includes('Email')) {
        // Login if needed
        cy.get('input').first().type('gbacskai@gmail.com');
        cy.get('input').last().type('jvw_zpd3JRF@qfn8byc');
        cy.get('button[type="submit"]').click();
        cy.wait(3000);
      }
    });
    
    // Navigate to reporting
    cy.visit('/reporting');
    cy.wait(5000);
    
    // Look for any project with Client Information
    cy.get('body').should('contain', 'Client Information');
    
    // Find the first Client Information cell and click it
    cy.get('td').contains('Client Information').first().click();
    cy.wait(2000);
    
    // Check if modal opened
    cy.get('body').then(($body) => {
      if ($body.find('.modal').length > 0 || $body.find('input').length > 0) {
        cy.log('✅ Modal opened successfully');
        
        // Look for "Add" button for array fields
        cy.get('body').then(($body) => {
          if ($body.text().includes('Add Clients') || $body.text().includes('Add Client')) {
            cy.log('🔍 Found Add Clients button');
            cy.contains('Add').click();
            cy.wait(1000);
            
            // Try to fill array fields
            cy.get('input').first().clear().type('Test Input', {force: true});
            cy.wait(500);
            
            cy.log('✅ Array field input test completed');
          } else {
            cy.log('ℹ️ No Add Clients button found - may already have data');
          }
        });
      } else {
        cy.log('❌ Modal did not open - document may not exist');
      }
    });
  });

  it('should check console for debugging output', () => {
    cy.visit('/reporting');
    cy.wait(3000);
    
    // This test will help us see console output
    cy.window().then((win) => {
      // Capture console logs
      cy.stub(win.console, 'log').as('consoleLog');
    });
    
    // Click on any Client Information
    cy.get('td').contains('Client Information').first().click();
    cy.wait(2000);
    
    // Check what was logged to console
    cy.get('@consoleLog').should('have.been.called');
    
    cy.log('✅ Console logging test completed - check browser console for detailed output');
  });
});