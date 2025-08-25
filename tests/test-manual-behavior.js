const puppeteer = require('puppeteer');

async function testManualUserBehavior() {
  console.log('🧪 Testing Manual User Behavior for Domain Selection...');
  console.log('===================================================');
  
  let browser;
  try {
    // Launch browser in non-headless mode so we can see what's happening
    browser = await puppeteer.launch({ 
      headless: true, // Show the browser
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
    
    // Check if we need to sign in
    console.log('🔐 Checking authentication status...');
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Check if we're on the landing page (unauthenticated) or need to authenticate
    const isLandingPage = currentUrl === 'http://localhost:4200/' || currentUrl.endsWith('/');
    const needsAuth = isLandingPage || currentUrl.includes('/auth');
    
    if (needsAuth) {
      console.log('🔐 Signing in...');
      
      // If we're on the landing page, click the login button to go to auth
      if (isLandingPage) {
        console.log('🔗 Clicking login button from landing page...');
        const loginButton = await page.$('.login-btn');
        if (loginButton) {
          await loginButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Fallback: navigate directly to auth page
          await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle2' });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else if (!currentUrl.includes('/auth')) {
        await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Try different selectors for email input
      let emailInput = await page.$('input[type="email"]') || 
                      await page.$('input[placeholder*="email"]') || 
                      await page.$('input[name="email"]') ||
                      await page.$('input[formControlName="email"]');
      
      if (emailInput) {
        console.log('📧 Entering email...');
        await emailInput.focus();
        await emailInput.type('gbacskai@gmail.com');
      } else {
        throw new Error('Email input not found');
      }
      
      // Try different selectors for password input
      let passwordInput = await page.$('input[type="password"]') || 
                         await page.$('input[placeholder*="password"]') || 
                         await page.$('input[name="password"]') ||
                         await page.$('input[formControlName="password"]');
      
      if (passwordInput) {
        console.log('🔒 Entering password...');
        await passwordInput.focus();
        await passwordInput.type('jvw_zpd3JRF@qfn8byc');
      } else {
        throw new Error('Password input not found');
      }
      
      // Try different selectors for sign in button
      let signInButton = await page.$('button[type="submit"]') ||
                        await page.$('.btn-primary');
      
      if (signInButton) {
        console.log('🚀 Clicking sign in...');
        await signInButton.click();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer for auth
        
        // Check if we're redirected to dashboard
        const newUrl = page.url();
        console.log(`After login URL: ${newUrl}`);
        if (newUrl.includes('/auth')) {
          throw new Error('Login may have failed - still on auth page');
        }
      } else {
        throw new Error('Sign in button not found');
      }
    }
    
    // Navigate to Document Types
    console.log('🔗 Navigating to Document Types...');
    await page.goto('http://localhost:4200/document-types', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if we actually reached the document-types page
    const finalUrl = page.url();
    console.log(`Final URL after navigation: ${finalUrl}`);
    
    if (!finalUrl.includes('/document-types')) {
      console.log('⚠️ Not on document-types page, user may not have access. Trying dashboard navigation...');
      
      // Try clicking the user menu and navigating through the app
      const userMenuButton = await page.$('.user-menu-button');
      if (userMenuButton) {
        await userMenuButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Look for document types in the menu
        const menuLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a')).map(link => ({
            text: link.textContent.trim(),
            href: link.href
          })).filter(link => link.text && link.href);
        });
        console.log('Available menu links:', menuLinks);
      }
      
      // Try clicking the Document Types link from the menu
      const docTypesLink = await page.$('a[href="/document-types"], a[href="http://localhost:4200/document-types"]');
      if (docTypesLink) {
        console.log('🔗 Clicking Document Types menu link...');
        await docTypesLink.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        // Fallback: try direct navigation
        console.log('🔗 Trying direct navigation to document-types...');
        await page.goto('http://localhost:4200/document-types', { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Debug: Check what's on the page
    console.log('🔍 Debugging page state...');
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log(`Page title: "${pageTitle}"`);
    console.log(`Page URL: ${pageUrl}`);
    
    // Try to find add button with multiple selectors
    console.log('📝 Looking for add button...');
    let addButton = await page.$('.add-button') ||
                   await page.$('button[class*="add"]') ||
                   await page.$('.btn[class*="add"]');
    
    if (!addButton) {
      // List all buttons to help debug
      const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent.trim(),
          class: btn.className,
          id: btn.id
        })).filter(btn => btn.text || btn.class || btn.id);
      });
      console.log('Available buttons:', buttons);
      throw new Error('Add button not found. Check if the page loaded correctly and user is authenticated.');
    }
    
    console.log('📝 Clicking add button...');
    await addButton.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Click Select Domains
    console.log('🔍 Opening domain selection sidebar...');
    const selectDomainsBtn = await page.$('.select-domains-btn');
    if (!selectDomainsBtn) {
      throw new Error('Select Domains button not found. Check if the add form opened correctly.');
    }
    await selectDomainsBtn.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Get initial count
    console.log('📊 Getting initial count...');
    const initialCountEl = await page.$('.sidebar-footer .selection-summary');
    if (!initialCountEl) {
      throw new Error('Selection summary element not found. Check if the domain sidebar opened correctly.');
    }
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