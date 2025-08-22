#!/usr/bin/env node

/**
 * Test Script: Code Confirmation Form Behavior
 * 
 * This script tests the verification form behavior when entering invalid credentials:
 * - Navigate to confirmation form
 * - Enter invalid email and code (dummy@dummy.com, 111111)
 * - Verify that the form stays on confirmation page and doesn't navigate away
 * - Check error messages are displayed properly
 */

console.log('🧪 Code Confirmation Form Test');
console.log('=====================================\n');

const puppeteer = require('puppeteer');

async function runTest() {
  let browser;
  let testsPassed = 0;
  let testsTotal = 0;

  try {
    // Launch browser with SSH-friendly settings
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({ 
      headless: 'new',  // Use new headless mode
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      defaultViewport: { width: 1200, height: 800 }
    });

    const page = await browser.newPage();
    
    // Capture console logs from the page
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Auth service:') || text.includes('Starting verification') || text.includes('Confirmation error')) {
        console.log('   [BROWSER CONSOLE]', text);
      }
    });
    
    // Navigate to the app
    console.log('🔗 Navigating to app...');
    await page.goto('http://localhost:4200', { waitUntil: 'networkidle0' });

    async function runTest(testName, testFn) {
      testsTotal++;
      console.log(`\n🔍 Running: ${testName}`);
      
      try {
        const result = await testFn();
        if (result === true || result === undefined) {
          console.log(`✅ PASSED: ${testName}`);
          testsPassed++;
        } else {
          console.log(`❌ FAILED: ${testName} - ${result}`);
        }
      } catch (error) {
        console.log(`❌ ERROR: ${testName} - ${error.message}`);
      }
    }

    // Test 1: Navigate to verification form
    await runTest('Navigate to verification form', async () => {
      console.log('   Looking for "Verify your email" link...');
      
      // Wait for and click "Verify your email" link
      await page.waitForSelector('button.link-btn', { timeout: 5000 });
      const verifyButton = await page.$('button.link-btn:last-child'); // "Verify your email" is the last link-btn
      
      if (!verifyButton) {
        return 'Verify your email button not found';
      }
      
      await verifyButton.click();
      
      // Wait for confirmation form to appear
      await page.waitForSelector('#confirmation-email', { timeout: 3000 });
      
      console.log('   Successfully navigated to verification form');
      return true;
    });

    // Test 2: Fill in invalid credentials
    await runTest('Fill invalid credentials', async () => {
      console.log('   Filling email: dummy@dummy.com');
      await page.type('#confirmation-email', 'dummy@dummy.com');
      
      console.log('   Filling code: 111111');
      await page.type('#confirmation-code', '111111');
      
      // Verify fields are filled
      const emailValue = await page.$eval('#confirmation-email', el => el.value);
      const codeValue = await page.$eval('#confirmation-code', el => el.value);
      
      console.log(`   Email field value: ${emailValue}`);
      console.log(`   Code field value: ${codeValue}`);
      
      return emailValue === 'dummy@dummy.com' && codeValue === '111111';
    });

    // Test 3: Submit form and verify it stays on confirmation page
    await runTest('Submit form and check it stays on confirmation page', async () => {
      console.log('   Looking for Verify Email button...');
      
      // First check all buttons on the page
      const allButtons = await page.$$('button');
      console.log(`   Found ${allButtons.length} buttons on page`);
      
      for (let i = 0; i < allButtons.length; i++) {
        const buttonText = await allButtons[i].evaluate(el => el.textContent?.trim());
        const buttonType = await allButtons[i].evaluate(el => el.type);
        const buttonClass = await allButtons[i].evaluate(el => el.className);
        console.log(`   Button ${i}: "${buttonText}" (type: ${buttonType}, class: ${buttonClass})`);
      }
      
      // Find the Verify Email button by text content
      let verifyButton = null;
      for (let button of allButtons) {
        const text = await button.evaluate(el => el.textContent?.trim());
        if (text === 'Verify Email') {
          verifyButton = button;
          break;
        }
      }
      
      if (!verifyButton) {
        return 'Verify Email button not found by text';
      }
      
      console.log('   Clicking Verify Email button...');
      await verifyButton.click();
      
      // Wait a bit for the API call and response
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('   Checking page state after click...');
      
      // Check what's on the page now
      const currentUrl = page.url();
      console.log(`   Current URL: ${currentUrl}`);
      
      // Check if still on confirmation form (email input should still exist)
      const emailField = await page.$('#confirmation-email');
      const codeField = await page.$('#confirmation-code');
      const h2Text = await page.$eval('h2', el => el.textContent).catch(() => 'No h2 found');
      
      console.log(`   Email field exists: ${!!emailField}`);
      console.log(`   Code field exists: ${!!codeField}`);
      console.log(`   Page title: ${h2Text}`);
      
      if (!emailField) {
        // Check what page we're on now
        const pageContent = await page.content();
        console.log('   Page navigated away. Current page content (first 500 chars):');
        console.log('   ' + pageContent.substring(0, 500) + '...');
        return 'Form navigated away - email field not found';
      }
      
      console.log('   ✓ Form stayed on confirmation page');
      
      // Check if error message is displayed
      const errorAlert = await page.$('.alert-error');
      if (!errorAlert) {
        console.log('   Looking for any alert messages...');
        const allAlerts = await page.$$('[class*="alert"]');
        console.log(`   Found ${allAlerts.length} alert elements`);
        
        for (let alert of allAlerts) {
          const alertText = await alert.evaluate(el => el.textContent?.trim());
          const alertClass = await alert.evaluate(el => el.className);
          console.log(`   Alert: "${alertText}" (class: ${alertClass})`);
        }
        
        return 'No error message displayed';
      }
      
      const errorText = await page.$eval('.alert-error', el => el.textContent);
      console.log(`   Error message displayed: "${errorText}"`);
      
      // Check that email field still has the value
      const emailValue = await page.$eval('#confirmation-email', el => el.value);
      console.log(`   Email field preserved: ${emailValue}`);
      
      // Check that code field is cleared (should be empty after error)
      const codeValue = await page.$eval('#confirmation-code', el => el.value);
      console.log(`   Code field cleared: ${codeValue === '' ? 'Yes' : 'No (' + codeValue + ')'}`);
      
      return emailValue === 'dummy@dummy.com' && codeValue === '';
    });

    // Test 4: Verify form functionality remains intact
    await runTest('Verify form remains functional', async () => {
      console.log('   Testing Resend Code button...');
      
      const resendButton = await page.$('button.btn-secondary');
      if (!resendButton) {
        return 'Resend Code button not found';
      }
      
      await resendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should still be on the same form
      const emailField = await page.$('#confirmation-email');
      if (!emailField) {
        return 'Form navigated away after Resend Code';
      }
      
      console.log('   ✓ Resend Code works and stays on form');
      
      // Test Back to Sign In link
      console.log('   Testing Back to Sign In link...');
      const backButton = await page.$('button.link-btn');
      if (!backButton) {
        return 'Back to Sign In button not found';
      }
      
      await backButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should navigate to login form
      const loginButton = await page.$('button[type="submit"]');
      const loginButtonText = await page.$eval('button[type="submit"]', el => el.textContent.trim());
      
      if (!loginButtonText.includes('Sign In')) {
        return 'Did not navigate back to login form';
      }
      
      console.log('   ✓ Back to Sign In works correctly');
      return true;
    });

    // Summary
    console.log('\n=====================================');
    console.log(`📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);
    
    if (testsPassed === testsTotal) {
      console.log('🎉 All tests passed! Confirmation form behavior is correct.');
      console.log('\n✅ Verified behaviors:');
      console.log('   - Form stays on confirmation page after invalid submission');
      console.log('   - Error message is displayed properly');
      console.log('   - Email field value is preserved');
      console.log('   - Code field is cleared after error');
      console.log('   - Resend Code button works');
      console.log('   - Back to Sign In navigation works');
    } else {
      console.log('⚠️  Some tests failed. Check the form behavior.');
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    if (browser) {
      console.log('\n🔄 Closing browser...');
      await browser.close();
    }
  }
}

// Check if puppeteer is available
try {
  runTest().catch(error => {
    console.error('❌ Test script failed:', error);
    console.log('\n💡 To install puppeteer: npm install --save-dev puppeteer');
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Puppeteer not found. Please install it first:');
  console.log('npm install --save-dev puppeteer');
  process.exit(1);
}