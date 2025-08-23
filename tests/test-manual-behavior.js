const puppeteer = require('puppeteer');

async function testManualUserBehavior() {
  console.log('🧪 Testing Manual User Behavior for Domain Selection...');
  console.log('===================================================');
  
  let browser;
  try {
    // Launch browser in non-headless mode so we can see what's happening
    browser = await puppeteer.launch({ 
      headless: false, // Show the browser
      slowMo: 250,     // Slow down actions
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Capture console logs
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'log' || type === 'info') {
        console.log(`🌐 BROWSER: ${text}`);
      } else if (type === 'error') {
        console.log(`🔴 BROWSER ERROR: ${text}`);
      }
    });
    
    await page.setViewport({ width: 1200, height: 800 });
    
    console.log('📍 Navigating to application...');
    await page.goto('http://localhost:4200', { waitUntil: 'networkidle2' });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Sign in
    console.log('🔐 Signing in...');
    const signInButton = await page.$('.btn-primary');
    if (signInButton) {
      const emailInput = await page.$('input[type="email"], input[placeholder*="email"], input[name="email"]');
      if (emailInput) {
        await emailInput.type('gbacskai@gmail.com');
      }
      
      const passwordInput = await page.$('input[type="password"], input[placeholder*="password"], input[name="password"]');
      if (passwordInput) {
        await passwordInput.type('jvw_zpd3JRF@qfn8byc');
      }
      
      await signInButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Navigate to Document Types
    console.log('🔗 Navigating to Document Types...');
    await page.goto('http://localhost:4200/document-types', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click Add button
    console.log('📝 Opening new document type form...');
    const addButton = await page.$('.add-button');
    await addButton.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Click Select Domains
    console.log('🔍 Opening domain selection sidebar...');
    const selectDomainsBtn = await page.$('.select-domains-btn');
    await selectDomainsBtn.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Get initial count
    console.log('📊 Getting initial count...');
    const initialCountEl = await page.$('.sidebar-footer .selection-summary');
    const initialText = await page.evaluate(el => el.textContent.trim(), initialCountEl);
    console.log(`📊 Initial: "${initialText}"`);
    
    // Test different click scenarios
    console.log('🎯 Testing different click methods...');
    
    const unselectedDomains = await page.$$('.domain-item:not(.selected)');
    if (unselectedDomains.length > 0) {
      const firstDomain = unselectedDomains[0];
      const domainName = await page.evaluate(el => {
        const h4 = el.querySelector('h4');
        return h4 ? h4.textContent.trim() : 'Unknown';
      }, firstDomain);
      
      console.log(`🎯 Testing domain: "${domainName}"`);
      
      // Method 1: Click on checkbox directly
      console.log('Method 1: Clicking checkbox directly...');
      const checkbox = await firstDomain.$('input[type="checkbox"]');
      if (checkbox) {
        await checkbox.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        let currentText = await page.evaluate(el => el.textContent.trim(), initialCountEl);
        console.log(`   After checkbox click: "${currentText}"`);
        
        // Reset by clicking again
        await checkbox.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Method 2: Click on domain-info area
      console.log('Method 2: Clicking domain-info area...');
      const domainInfo = await firstDomain.$('.domain-info');
      if (domainInfo) {
        await domainInfo.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        let currentText = await page.evaluate(el => el.textContent.trim(), initialCountEl);
        console.log(`   After domain-info click: "${currentText}"`);
        
        // Test visual feedback
        const isSelected = await page.evaluate(el => el.classList.contains('selected'), firstDomain);
        console.log(`   Visual selection: ${isSelected ? '✅ Selected' : '❌ Not selected'}`);
      }
      
      // Method 3: Click on domain name (h4)
      console.log('Method 3: Clicking domain name...');
      await domainInfo.click(); // Reset first
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const domainNameEl = await firstDomain.$('h4');
      if (domainNameEl) {
        await domainNameEl.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        let currentText = await page.evaluate(el => el.textContent.trim(), initialCountEl);
        console.log(`   After domain name click: "${currentText}"`);
      }
    }
    
    console.log('🔧 Final state check...');
    const finalText = await page.evaluate(el => el.textContent.trim(), initialCountEl);
    console.log(`📊 Final count: "${finalText}"`);
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser will stay open for 30 seconds for manual inspection...');
    console.log('    Try clicking domains manually to see if count updates');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testManualUserBehavior().catch(console.error);