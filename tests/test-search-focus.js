const puppeteer = require('puppeteer');

async function testSearchFocus() {
  console.log('🔍 Starting Search Focus Test...');
  console.log('=====================================');
  
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({ 
      headless: true,
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
    
    // Step 1: Navigate and Login
    console.log('🔐 Step 1: Logging in...');
    await page.goto('http://localhost:4200', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const signInButton = await page.$('.btn-primary');
    if (signInButton) {
      const emailInput = await page.$('input[type="email"], input[placeholder*="email"], input[name="email"]');
      if (emailInput) {
        await emailInput.type('gbacskai@gmail.com');
        console.log('✅ Email entered');
      }
      
      const passwordInput = await page.$('input[type="password"], input[placeholder*="password"], input[name="password"]');
      if (passwordInput) {
        await passwordInput.type('jvw_zpd3JRF@qfn8byc');
        console.log('✅ Password entered');
      }
      
      await signInButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✅ Logged in successfully');
    }
    
    // Step 2: Navigate to Document Types
    console.log('📋 Step 2: Navigating to Document Types...');
    await page.goto('http://localhost:4200/document-types', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Reached Document Types page');
    
    // Step 3: Open new document type form
    console.log('📝 Step 3: Opening new document type form...');
    const addButton = await page.$('.add-button');
    await addButton.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Form opened');
    
    // Step 4: Open domain selection sidebar
    console.log('🔍 Step 4: Opening domain selection sidebar...');
    const selectDomainsBtn = await page.$('.select-domains-btn');
    await selectDomainsBtn.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Domain sidebar opened');
    
    // Step 5: Find and focus on search input
    console.log('🎯 Step 5: Locating search input...');
    const searchInput = await page.$('.search-input');
    if (!searchInput) {
      throw new Error('Search input not found');
    }
    
    // Click on search input to focus it
    await searchInput.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('✅ Search input focused');
    
    // Step 6: Test typing "N S W" character by character
    console.log('⌨️  Step 6: Typing "N S W" character by character...');
    const searchText = 'N S W';
    const focusResults = [];
    let currentValue = '';
    
    for (let i = 0; i < searchText.length; i++) {
      const char = searchText[i];
      currentValue += char;
      
      console.log(`   Typing character ${i + 1}: "${char}"`);
      
      // Type the character
      await searchInput.type(char);
      
      // Wait a bit for any re-rendering
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Check if focus is still on the search input
      const focusedElement = await page.evaluate(() => {
        const activeEl = document.activeElement;
        return {
          tagName: activeEl ? activeEl.tagName : null,
          className: activeEl ? activeEl.className : null,
          placeholder: activeEl ? activeEl.placeholder : null,
          value: activeEl ? activeEl.value : null,
          isFocused: activeEl ? activeEl === document.querySelector('.search-input') : false
        };
      });
      
      // Get current search input value
      const inputValue = await page.evaluate(el => el.value, searchInput);
      
      console.log(`   After typing "${char}":`);
      console.log(`     - Input value: "${inputValue}"`);
      console.log(`     - Expected value: "${currentValue}"`);
      console.log(`     - Focus maintained: ${focusedElement.isFocused ? '✅ YES' : '❌ NO'}`);
      console.log(`     - Focused element: ${focusedElement.tagName} (${focusedElement.className})`);
      
      focusResults.push({
        character: char,
        position: i + 1,
        inputValue: inputValue,
        expectedValue: currentValue,
        focusMaintained: focusedElement.isFocused,
        focusedElement: `${focusedElement.tagName}.${focusedElement.className}`
      });
      
      // If focus was lost, try to click back on input for next character
      if (!focusedElement.isFocused) {
        console.log(`   ⚠️  Focus lost after "${char}", clicking search input to refocus...`);
        await searchInput.click();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Step 7: Check final search results
    console.log('🔍 Step 7: Checking search results...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for search to complete
    
    // Count domains in results
    const domainItems = await page.$$('.domain-item');
    const domainCount = domainItems.length;
    
    // Get domain names from results
    const domainNames = await page.evaluate(() => {
      const domains = document.querySelectorAll('.domain-item h4');
      return Array.from(domains).map(h4 => h4.textContent.trim());
    });
    
    console.log(`✅ Search completed - found ${domainCount} domains`);
    console.log('📋 Search results:');
    domainNames.forEach((name, index) => {
      console.log(`   ${index + 1}. ${name}`);
    });
    
    // Step 8: Summary Report
    console.log('');
    console.log('📊 FOCUS TEST SUMMARY');
    console.log('=====================');
    
    const totalChars = focusResults.length;
    const focusLostCount = focusResults.filter(r => !r.focusMaintained).length;
    const focusMaintainedCount = totalChars - focusLostCount;
    
    console.log(`Total characters typed: ${totalChars}`);
    console.log(`Focus maintained: ${focusMaintainedCount}/${totalChars} (${Math.round((focusMaintainedCount/totalChars)*100)}%)`);
    console.log(`Focus lost: ${focusLostCount}/${totalChars} (${Math.round((focusLostCount/totalChars)*100)}%)`);
    console.log('');
    
    console.log('Character-by-character breakdown:');
    focusResults.forEach(result => {
      const status = result.focusMaintained ? '✅' : '❌';
      console.log(`  ${status} "${result.character}" (pos ${result.position}): Focus ${result.focusMaintained ? 'maintained' : 'LOST'}`);
    });
    
    console.log('');
    console.log('🔍 Search Results Summary:');
    console.log(`- Final search query: "${searchText}"`);
    console.log(`- Domains found: ${domainCount}`);
    console.log(`- Search functionality: ${domainCount > 0 ? '✅ Working' : '❌ No results'}`);
    
    // Final assessment
    console.log('');
    if (focusLostCount === 0) {
      console.log('🎉 TEST PASSED: Search focus maintained throughout typing!');
    } else if (focusLostCount < totalChars) {
      console.log('⚠️  TEST PARTIALLY FAILED: Focus lost on some characters');
    } else {
      console.log('❌ TEST FAILED: Focus lost on all characters');
    }
    
    return focusLostCount === 0;
    
  } catch (error) {
    console.log('');
    console.log('💥 TEST ERROR');
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testSearchFocus().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});