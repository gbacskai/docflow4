describe('Client Information Array Field Test', () => {
  const testClientData = {
    firstName: 'John',
    lastName: 'Doe', 
    address: '123 Main Street, Sydney NSW 2000',
    mobile: '(61) 449-123-456',
    email: 'john.doe@example.com'
  };

  beforeEach(() => {
    // Try to visit reporting page directly, login if needed
    cy.visit('/reporting');
    
    // Check if we get redirected to login
    cy.url().then((url) => {
      if (url.includes('/auth') || url.includes('/login')) {
        // Need to login
        cy.get('input[type="email"]', { timeout: 5000 }).should('be.visible').type('gbacskai@gmail.com');
        cy.get('input[type="password"]').should('be.visible').type('jvw_zpd3JRF@qfn8byc');
        cy.get('button[type="submit"]').click();
        
        // Wait for login to complete and redirect to reporting
        cy.url().should('include', '/reporting');
        cy.wait(3000);
      }
    });
  });

  it('should save and load client information with array fields', () => {
    // Step 1: Already on reporting page from beforeEach
    cy.log('🔍 Step 1: On reporting page');
    cy.wait(3000); // Wait for page to load
    
    // Step 2: Find "Lovely Little Cottage" project and click Client Information
    cy.log('🔍 Step 2: Looking for Lovely Little Cottage project');
    cy.contains('Lovely Little Cottage', { timeout: 15000 }).should('be.visible');
    
    // Find the Client Information cell for Lovely Little Cottage
    cy.get('table').should('be.visible');
    cy.contains('tr', 'Lovely Little Cottage').within(() => {
      // Look for Client Information column and click any clickable element
      cy.get('td').contains('Client Information').click();
    });
    
    // Step 3: Wait for modal to open
    cy.log('🔍 Step 3: Waiting for Client Information modal');
    cy.get('.modal, .document-modal', { timeout: 10000 }).should('be.visible');
    cy.contains('Client Information').should('be.visible');
    
    // Step 4: Add a new client
    cy.log('🔍 Step 4: Adding a new client');
    
    // Click "Add Clients" button
    cy.contains('button', 'Add Clients', { timeout: 5000 }).should('be.visible').click();
    cy.wait(1000);
    
    // Verify client form appeared
    cy.contains('Clients #1').should('be.visible');
    
    // Fill out all required fields
    cy.log('🔍 Step 4a: Filling First Name');
    cy.contains('First Name').parent().find('input').should('be.visible').clear().type(testClientData.firstName);
    cy.wait(500);
    
    cy.log('🔍 Step 4b: Filling Last Name');
    cy.contains('Last Name').parent().find('input').should('be.visible').clear().type(testClientData.lastName);
    cy.wait(500);
    
    cy.log('🔍 Step 4c: Filling Address');
    cy.contains('Postal Address').parent().find('input').should('be.visible').clear().type(testClientData.address);
    cy.wait(500);
    
    cy.log('🔍 Step 4d: Filling Mobile');
    cy.contains('Phone').parent().find('input').should('be.visible').clear().type(testClientData.mobile);
    cy.wait(500);
    
    cy.log('🔍 Step 4e: Filling Email');
    cy.contains('Email').parent().find('input').should('be.visible').clear().type(testClientData.email);
    cy.wait(1000);
    
    // Step 5: Save the form
    cy.log('🔍 Step 5: Saving the form');
    
    // Wait for form to be valid and save button to be enabled
    cy.get('button').contains('Save & Run Workflow').should('be.visible');
    
    // Check if button becomes enabled (may take a moment for validation)
    cy.wait(2000);
    cy.get('button').contains('Save & Run Workflow').should('not.be.disabled').click();
    
    // Wait for save to complete
    cy.wait(3000);
    
    // Look for success indicators (modal might close or show success message)
    cy.get('body').should('contain.text', 'successfully').or('not.contain', 'Client Information');
    
    // Step 6: Reopen and verify data was saved
    cy.log('🔍 Step 6: Reopening Client Information to verify data');
    
    // If modal closed, reopen it
    cy.get('body').then(($body) => {
      if ($body.find('.modal').length === 0) {
        // Modal closed, need to reopen
        cy.contains('tr', 'Lovely Little Cottage').within(() => {
          cy.get('td').contains('Client Information').parent().find('button, .document-icon, .clickable').first().click();
        });
        cy.get('.modal, .document-modal', { timeout: 10000 }).should('be.visible');
      }
    });
    
    // Verify all the data is still there
    cy.log('🔍 Step 6a: Verifying saved data');
    
    cy.contains('Clients #1').should('be.visible');
    
    // Check First Name
    cy.contains('First Name').parent().find('input').should('have.value', testClientData.firstName);
    
    // Check Last Name  
    cy.contains('Last Name').parent().find('input').should('have.value', testClientData.lastName);
    
    // Check Address
    cy.contains('Postal Address').parent().find('input').should('have.value', testClientData.address);
    
    // Check Mobile
    cy.contains('Phone').parent().find('input').should('have.value', testClientData.mobile);
    
    // Check Email
    cy.contains('Email').parent().find('input').should('have.value', testClientData.email);
    
    cy.log('✅ Test completed successfully - Client information was saved and loaded correctly');
  });

  it('should validate required fields in client array', () => {
    // Navigate to reporting page
    cy.visit('/reporting', { timeout: 10000 });
    cy.wait(3000);
    
    // Open Client Information modal
    cy.contains('Lovely Little Cottage', { timeout: 10000 }).should('be.visible');
    cy.contains('tr', 'Lovely Little Cottage').within(() => {
      cy.get('td').contains('Client Information').parent().find('button, .document-icon, .clickable').first().click();
    });
    
    cy.get('.modal, .document-modal', { timeout: 10000 }).should('be.visible');
    
    // Add a client but don't fill required fields
    cy.contains('button', 'Add Clients').click();
    cy.wait(1000);
    
    // Only fill first name, leave others empty
    cy.contains('First Name').parent().find('input').clear().type('Test');
    cy.wait(1000);
    
    // Try to save - button should be disabled
    cy.get('button').contains('Save & Run Workflow').should('be.disabled');
    
    cy.log('✅ Validation test passed - Save button correctly disabled when required fields are empty');
  });

  afterEach(() => {
    // Close any open modals
    cy.get('body').then(($body) => {
      if ($body.find('.modal .close-btn, .modal .btn-cancel').length > 0) {
        cy.get('.modal .close-btn, .modal .btn-cancel').first().click();
      }
    });
  });
});