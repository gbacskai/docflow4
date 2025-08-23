const puppeteer = require('puppeteer');

async function runAuthenticatedDomainSelectionTest() {
  console.log('🚀 Starting Authenticated Domain Selection Test...');
  console.log('================================================');
  
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Capture console logs from the page
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'log' || type === 'info') {
        console.log(`🌐 BROWSER: ${text}`);
      } else if (type === 'error') {
        console.log(`🔴 BROWSER ERROR: ${text}`);
      }
    });
    
    // Set viewport
    await page.setViewport({ width: 1200, height: 800 });
    
    // Navigate to the application
    console.log('📍 Navigating to application...');
    await page.goto('http://localhost:4200', { waitUntil: 'networkidle2' });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 1: Handle Authentication
    console.log('🔐 Step 1: Handling authentication...');
    
    // Check if we're on a sign-in page
    const signInButton = await page.$('.btn-primary');
    if (signInButton) {
      const buttonText = await page.evaluate(el => el.textContent.trim(), signInButton);
      if (buttonText === 'Sign In') {
        console.log('🔑 Found sign-in form, attempting to sign in...');
        
        // Look for email input
        const emailInput = await page.$('input[type="email"], input[placeholder*="email"], input[name="email"]');
        if (emailInput) {
          await emailInput.type('gbacskai@gmail.com');
          console.log('✅ Email entered');
        }
        
        // Look for password input
        const passwordInput = await page.$('input[type="password"], input[placeholder*="password"], input[name="password"]');
        if (passwordInput) {
          await passwordInput.type('jvw_zpd3JRF@qfn8byc');
          console.log('✅ Password entered');
        }
        
        // Click sign in button
        await signInButton.click();
        console.log('🔄 Clicking sign in...');
        
        // Wait for authentication to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if we need to handle any additional auth steps
        const currentUrl = page.url();
        console.log('📍 Current URL after auth attempt:', currentUrl);
      }
    } else {
      console.log('✅ No sign-in required or already authenticated');
    }
    
    // Step 2: Navigate to Document Types page
    console.log('🔗 Step 2: Navigating to Document Types page...');
    await page.goto('http://localhost:4200/document-types', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we successfully reached the document types page
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved as test-screenshot.png');
    
    // Check what's on the page
    const pageContent = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent.trim(),
        className: btn.className
      }));
      
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim());
      
      return { buttons, headings };
    });
    
    console.log('🔍 Page content analysis:');
    console.log('Headings:', pageContent.headings);
    console.log('Buttons:', pageContent.buttons.slice(0, 5)); // Show first 5 buttons
    
    // Look for the add button (various possible selectors)
    let addButton = await page.$('.add-button');
    if (!addButton) {
      addButton = await page.$('button:contains("New Document Type")');
    }
    if (!addButton) {
      // Try to find by text content
      addButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => 
          btn.textContent.includes('New Document Type') || 
          btn.textContent.includes('Add') ||
          btn.textContent.includes('Create')
        );
      });
    }
    
    if (!addButton || await page.evaluate(el => !el, addButton)) {
      throw new Error('Add button not found - may still be on auth page or page not loaded correctly');
    }
    
    console.log('✅ Add button found, proceeding with test...');
    
    // Step 3: Click "New Document Type" button
    console.log('📝 Step 3: Opening new document type form...');
    await addButton.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Verify form opened
    const form = await page.$('.document-type-form');
    if (!form) {
      throw new Error('Document type form did not open');
    }
    console.log('✅ Document type form opened successfully');
    
    // Step 4: Click "Select Domains" button
    console.log('🔍 Step 4: Opening domain selection sidebar...');
    const selectDomainsBtn = await page.$('.select-domains-btn');
    if (!selectDomainsBtn) {
      throw new Error('Select Domains button not found');
    }
    
    await selectDomainsBtn.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Verify sidebar opened
    const sidebar = await page.$('.domain-sidebar');
    if (!sidebar) {
      throw new Error('Domain sidebar did not open');
    }
    console.log('✅ Domain sidebar opened successfully');
    
    // Step 5: Get initial selection count
    console.log('📊 Step 5: Getting initial selection count...');
    const initialCountElement = await page.$('.sidebar-footer .selection-summary');
    if (!initialCountElement) {
      throw new Error('Selection summary not found');
    }
    
    const initialCountText = await page.evaluate(el => el.textContent.trim(), initialCountElement);
    const initialCountMatch = initialCountText.match(/(\d+) domain\(s\) selected/);
    const initialCount = initialCountMatch ? parseInt(initialCountMatch[1]) : 0;
    console.log(`📈 Initial selection count: ${initialCount}`);
    
    // Step 6: Find the first unselected domain
    console.log('🎯 Step 6: Finding first unselected domain...');
    const unselectedDomains = await page.$$('.domain-item:not(.selected)');
    if (unselectedDomains.length === 0) {
      throw new Error('No unselected domains found');
    }
    
    const firstUnselectedDomain = unselectedDomains[0];
    const domainNameElement = await firstUnselectedDomain.$('h4');
    const domainName = await page.evaluate(el => el ? el.textContent.trim() : 'Unknown', domainNameElement);
    console.log(`🎯 Found unselected domain: ${domainName}`);
    
    // Step 7: Click the domain to select it
    console.log('👆 Step 7: Clicking to select domain...');
    const domainInfo = await firstUnselectedDomain.$('.domain-info');
    if (!domainInfo) {
      throw new Error('Domain info section not found');
    }
    await domainInfo.click();
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Step 8: Check if domain became selected (visual feedback)
    console.log('✨ Step 8: Checking visual selection feedback...');
    const isSelected = await page.evaluate(domain => domain.classList.contains('selected'), firstUnselectedDomain);
    if (isSelected) {
      console.log('✅ Domain shows as selected (has .selected class)');
    } else {
      console.log('❌ Domain does not show as selected (missing .selected class)');
    }
    
    // Step 9: Check if selection count increased
    console.log('📊 Step 9: Checking if selection count increased...');
    
    // Wait for Angular to process the change
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Monitor selection-summary changes over time
    const selectionChanges = await page.evaluate(async () => {
      const results = [];
      const summaryEl = document.querySelector('.sidebar-footer .selection-summary');
      
      if (!summaryEl) {
        return ['Selection summary element not found'];
      }
      
      // Capture changes over time
      for (let i = 0; i < 10; i++) {
        const currentText = summaryEl.textContent.trim();
        results.push(`${i * 100}ms: "${currentText}"`);
        await new Promise(r => setTimeout(r, 100));
      }
      
      return results;
    });
    
    console.log('📊 Selection summary changes over time:');
    selectionChanges.forEach(change => console.log(`   ${change}`));
    
    // Get the final count
    const newCountElement = await page.$('.sidebar-footer .selection-summary');
    if (!newCountElement) {
      throw new Error('Selection summary element disappeared');
    }
    
    const newCountText = await page.evaluate(el => el.textContent.trim(), newCountElement);
    console.log(`📊 Final selection text: "${newCountText}"`);
    
    // Also check if Angular's signal is updating by executing in browser context
    const angularState = await page.evaluate(() => {
      // Try to access the component instance
      const docTypesElement = document.querySelector('app-document-types');
      if (docTypesElement && docTypesElement.__ngContext__) {
        const component = docTypesElement.__ngContext__[8]; // Component instance might be here
        if (component && typeof component.tempSelectedDomains === 'function') {
          return {
            tempDomainsLength: component.tempSelectedDomains().length,
            tempDomainsValue: component.tempSelectedDomains()
          };
        }
      }
      return { error: 'Could not access component instance' };
    });
    
    console.log('🔧 Angular component state:', angularState);
    
    const newCountMatch = newCountText.match(/(\d+) domain\(s\) selected/);
    const newCount = newCountMatch ? parseInt(newCountMatch[1]) : 0;
    console.log(`📈 New selection count: ${newCount}`);
    
    if (newCount === initialCount + 1) {
      console.log('✅ Selection count increased by 1 as expected');
    } else {
      console.log(`❌ Expected count: ${initialCount + 1}, Actual count: ${newCount}`);
      throw new Error(`Selection count did not increase correctly`);
    }
    
    // Step 10: Test the Apply button functionality
    console.log('🔄 Step 10: Testing Apply button...');
    const applyBtn = await page.$('.btn-apply');
    if (!applyBtn) {
      throw new Error('Apply button not found');
    }
    await applyBtn.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Step 11: Check if sidebar closed
    console.log('👀 Step 11: Checking if sidebar closed...');
    const sidebarAfterApply = await page.$('.domain-sidebar');
    if (!sidebarAfterApply) {
      console.log('✅ Sidebar closed successfully');
    } else {
      console.log('❌ Sidebar did not close');
      throw new Error('Sidebar did not close after applying selection');
    }
    
    // Step 12: Check if main form shows the selected domain
    console.log('📋 Step 12: Checking main form display...');
    const selectedDomainsDisplay = await page.$('.selected-domains-display');
    if (selectedDomainsDisplay) {
      const displayedDomains = await page.$$('.selected-domain-item');
      console.log(`✅ Main form shows ${displayedDomains.length} selected domain(s)`);
      
      // Check if our selected domain is displayed
      const domainNames = await page.$$eval('.selected-domain-item .domain-name', 
        elements => elements.map(el => el.textContent.trim())
      );
      
      if (domainNames.includes(domainName)) {
        console.log(`✅ Selected domain "${domainName}" is displayed in main form`);
      } else {
        console.log(`❌ Selected domain "${domainName}" is NOT displayed in main form`);
        console.log('Displayed domains:', domainNames);
        throw new Error(`Selected domain not displayed in main form`);
      }
    } else {
      // Check if there's a "no domains" message when there should be domains
      const noDomains = await page.$('.no-domains-message');
      if (noDomains) {
        console.log('❌ Main form still shows "No domains selected" after applying selection');
        throw new Error('Main form shows no domains selected after applying');
      }
    }
    
    // All tests passed!
    console.log('');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Domain selection functionality is working correctly');
    console.log('================================================');
    return true;
    
  } catch (error) {
    console.log('');
    console.log('🚨 TEST FAILED');
    console.error('❌ Error:', error.message);
    console.log('================================================');
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
runAuthenticatedDomainSelectionTest().then(result => {
  process.exit(result ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});