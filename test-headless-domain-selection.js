const puppeteer = require('puppeteer');

async function runHeadlessDomainSelectionTest() {
  console.log('🚀 Starting Headless Domain Selection Test...');
  console.log('===========================================');
  
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1200, height: 800 });
    
    // Navigate to the application
    console.log('📍 Navigating to application...');
    await page.goto('http://localhost:4200', { waitUntil: 'networkidle2' });
    
    // Wait a bit for the app to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 1: Navigate to Document Types page
    console.log('🔗 Step 1: Navigating to Document Types page...');
    
    // Navigate directly to document types page
    await page.goto('http://localhost:4200/document-types', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if we're on the right page
    const currentUrl = page.url();
    if (!currentUrl.includes('document-types')) {
      throw new Error('Failed to navigate to Document Types page');
    }
    console.log('✅ Successfully navigated to Document Types page');
    
    // Step 2: Click "New Document Type" button
    console.log('📝 Step 2: Opening new document type form...');
    await page.waitForSelector('.add-button', { timeout: 5000 });
    await page.click('.add-button');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify form opened
    const formVisible = await page.$('.document-type-form');
    if (!formVisible) {
      throw new Error('Document type form did not open');
    }
    console.log('✅ Document type form opened successfully');
    
    // Step 3: Click "Select Domains" button
    console.log('🔍 Step 3: Opening domain selection sidebar...');
    await page.waitForSelector('.select-domains-btn', { timeout: 5000 });
    await page.click('.select-domains-btn');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify sidebar opened
    const sidebar = await page.$('.domain-sidebar');
    if (!sidebar) {
      throw new Error('Domain sidebar did not open');
    }
    console.log('✅ Domain sidebar opened successfully');
    
    // Step 4: Get initial selection count
    console.log('📊 Step 4: Getting initial selection count...');
    const initialCountElement = await page.$('.sidebar-footer .selection-summary');
    if (!initialCountElement) {
      throw new Error('Selection summary not found');
    }
    
    const initialCountText = await page.evaluate(el => el.textContent.trim(), initialCountElement);
    const initialCountMatch = initialCountText.match(/(\d+) domain\(s\) selected/);
    const initialCount = initialCountMatch ? parseInt(initialCountMatch[1]) : 0;
    console.log(`📈 Initial selection count: ${initialCount}`);
    
    // Step 5: Find the first unselected domain
    console.log('🎯 Step 5: Finding first unselected domain...');
    const unselectedDomains = await page.$$('.domain-item:not(.selected)');
    if (unselectedDomains.length === 0) {
      throw new Error('No unselected domains found');
    }
    
    const firstUnselectedDomain = unselectedDomains[0];
    const domainNameElement = await firstUnselectedDomain.$('h4');
    const domainName = await page.evaluate(el => el.textContent.trim(), domainNameElement);
    console.log(`🎯 Found unselected domain: ${domainName}`);
    
    // Step 6: Click the domain to select it
    console.log('👆 Step 6: Clicking to select domain...');
    const domainInfo = await firstUnselectedDomain.$('.domain-info');
    if (!domainInfo) {
      throw new Error('Domain info section not found');
    }
    await domainInfo.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 7: Check if domain became selected (visual feedback)
    console.log('✨ Step 7: Checking visual selection feedback...');
    const isSelected = await page.evaluate(domain => domain.classList.contains('selected'), firstUnselectedDomain);
    if (isSelected) {
      console.log('✅ Domain shows as selected (has .selected class)');
    } else {
      console.log('❌ Domain does not show as selected (missing .selected class)');
    }
    
    // Step 8: Check if selection count increased
    console.log('📊 Step 8: Checking if selection count increased...');
    const newCountText = await page.evaluate(el => el.textContent.trim(), initialCountElement);
    const newCountMatch = newCountText.match(/(\d+) domain\(s\) selected/);
    const newCount = newCountMatch ? parseInt(newCountMatch[1]) : 0;
    console.log(`📈 New selection count: ${newCount}`);
    
    if (newCount === initialCount + 1) {
      console.log('✅ Selection count increased by 1 as expected');
    } else {
      console.log(`❌ Expected count: ${initialCount + 1}, Actual count: ${newCount}`);
      throw new Error(`Selection count did not increase correctly`);
    }
    
    // Step 9: Test the Apply button functionality
    console.log('🔄 Step 9: Testing Apply button...');
    const applyBtn = await page.$('.btn-apply');
    if (!applyBtn) {
      throw new Error('Apply button not found');
    }
    await applyBtn.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 10: Check if sidebar closed
    console.log('👀 Step 10: Checking if sidebar closed...');
    const sidebarAfterApply = await page.$('.domain-sidebar');
    if (!sidebarAfterApply) {
      console.log('✅ Sidebar closed successfully');
    } else {
      console.log('❌ Sidebar did not close');
      throw new Error('Sidebar did not close after applying selection');
    }
    
    // Step 11: Check if main form shows the selected domain
    console.log('📋 Step 11: Checking main form display...');
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
    console.log('===========================================');
    return true;
    
  } catch (error) {
    console.log('');
    console.log('🚨 TEST FAILED');
    console.error('❌ Error:', error.message);
    console.log('===========================================');
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
runHeadlessDomainSelectionTest().then(result => {
  process.exit(result ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});