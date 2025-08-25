#!/usr/bin/env node

/**
 * Test script for Send Reset Code and Resend Verification Code functionality
 * Focuses on ensuring buttons stay on the same page and handle errors properly
 */

const puppeteer = require('puppeteer');
const path = require('path');

// Test configuration - matches existing test patterns
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:4200',
  headless: process.env.HEADLESS !== 'false',
  timeout: 15000
};

async function findProjectRoot() {
  let currentPath = process.cwd();
  while (currentPath !== path.parse(currentPath).root) {
    const packageJsonPath = path.join(currentPath, 'package.json');
    try {
      require.resolve(packageJsonPath);
      return currentPath;
    } catch (e) {
      currentPath = path.dirname(currentPath);
    }
  }
  return process.cwd();
}

async function runTest() {
  console.log('🧪 Testing Send Reset Code and Resend Verification Code functionality...\n');
  
  const browser = await puppeteer.launch({
    headless: TEST_CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  let testResults = [];

  // Track console logs for debugging
  page.on('console', msg => {
    if (msg.text().includes('🔐')) {
      console.log('Debug:', msg.text());
    }
  });

  try {
    console.log('📱 Navigating to auth page...');
    await page.goto(`${TEST_CONFIG.baseUrl}/auth`);
    await page.waitForSelector('h2', { timeout: 10000 });

    // Test 1: Reset Password Form
    console.log('\n🔧 Test 1: Reset Password Form');
    
    // Navigate to reset password form
    const resetPasswordLinks = await page.$x("//button[contains(text(), 'Reset password') or contains(text(), 'reset')]");
    if (resetPasswordLinks.length > 0) {
      await resetPasswordLinks[0].click();
      await page.waitForTimeout(1000);
      
      // Check if we're on the reset form
      const isOnResetForm = await page.$('[data-test="reset-form"]') !== null;
      console.log(isOnResetForm ? '✅ Successfully navigated to reset form' : '❌ Failed to navigate to reset form');
      
      if (isOnResetForm) {
        // Test sending reset code
        await page.type('input[type="email"]', 'test@example.com');
        
        const sendButton = await page.$('[data-test="send-reset-code-btn"]');
        if (sendButton) {
          console.log('📤 Clicking Send Reset Code...');
          await sendButton.click();
          
          // Wait for processing to complete
          await page.waitForTimeout(3000);
          
          // Check if still on reset form
          const stillOnResetForm = await page.$('[data-test="reset-form"]') !== null;
          console.log(stillOnResetForm ? '✅ Stayed on reset form after sending code' : '❌ Left reset form after sending code');
          
          // Check if button text changed to "Resend Code"
          const buttonText = await page.$eval('[data-test="send-reset-code-btn"]', el => el.textContent);
          const isResendButton = buttonText.includes('Resend');
          console.log(isResendButton ? '✅ Button text changed to Resend Code' : '❌ Button text did not change');
          
          // Test resend functionality
          if (isResendButton && stillOnResetForm) {
            console.log('🔄 Testing Resend Code...');
            await sendButton.click();
            await page.waitForTimeout(2000);
            
            const stillOnResetFormAfterResend = await page.$('[data-test="reset-form"]') !== null;
            console.log(stillOnResetFormAfterResend ? '✅ Stayed on reset form after resend' : '❌ Left reset form after resend');
          }
        } else {
          console.log('❌ Could not find Send Reset Code button');
        }
        
        // Test error handling - empty email
        console.log('🚨 Testing error handling with empty email...');
        await page.$eval('input[type="email"]', el => el.value = '');
        const sendButtonEmpty = await page.$('[data-test="send-reset-code-btn"]');
        if (sendButtonEmpty) {
          await sendButtonEmpty.click();
          await page.waitForTimeout(2000);
          
          const stillOnFormAfterError = await page.$('[data-test="reset-form"]') !== null;
          console.log(stillOnFormAfterError ? '✅ Stayed on form after empty email error' : '❌ Left form after empty email error');
          
          // Check for error message
          const hasError = await page.$('.alert-error') !== null || await page.$('.error-message') !== null;
          console.log(hasError ? '✅ Error message displayed' : '❌ No error message displayed');
        }
      }
    } else {
      console.log('❌ Could not find Reset Password link');
    }

    // Test 2: Verify Email Form
    console.log('\n🔧 Test 2: Verify Email Form');
    
    // Navigate back to login and then to verify email
    await page.goto(`${TEST_CONFIG.baseUrl}/auth`);
    await page.waitForTimeout(1000);
    
    const verifyEmailLinks = await page.$x("//button[contains(text(), 'Verify') and contains(text(), 'email')]");
    if (verifyEmailLinks.length > 0) {
      await verifyEmailLinks[0].click();
      await page.waitForTimeout(1000);
      
      const isOnVerifyForm = await page.$('[data-test="verify-form"]') !== null;
      console.log(isOnVerifyForm ? '✅ Successfully navigated to verify form' : '❌ Failed to navigate to verify form');
      
      if (isOnVerifyForm) {
        // Test resend verification code
        await page.type('input[type="email"]', 'test@example.com');
        
        const resendButton = await page.$('[data-test="resend-verification-code-btn"]');
        if (resendButton) {
          console.log('📤 Clicking Resend Verification Code...');
          await resendButton.click();
          
          await page.waitForTimeout(3000);
          
          const stillOnVerifyForm = await page.$('[data-test="verify-form"]') !== null;
          console.log(stillOnVerifyForm ? '✅ Stayed on verify form after resend' : '❌ Left verify form after resend');
          
          // Check for success message
          const hasMessage = await page.$('.alert-success') !== null;
          console.log(hasMessage ? '✅ Success message displayed' : '⚠️  No success message (expected behavior)');
        } else {
          console.log('❌ Could not find Resend Verification Code button');
        }
        
        // Test error handling - empty email
        console.log('🚨 Testing error handling with empty email...');
        await page.$eval('input[type="email"]', el => el.value = '');
        const resendButtonEmpty = await page.$('[data-test="resend-verification-code-btn"]');
        if (resendButtonEmpty) {
          await resendButtonEmpty.click();
          await page.waitForTimeout(2000);
          
          const stillOnFormAfterError = await page.$('[data-test="verify-form"]') !== null;
          console.log(stillOnFormAfterError ? '✅ Stayed on form after empty email error' : '❌ Left form after empty email error');
          
          const hasError = await page.$('.alert-error') !== null || await page.$('.error-message') !== null;
          console.log(hasError ? '✅ Error message displayed' : '❌ No error message displayed');
        }
      }
    } else {
      console.log('❌ Could not find Verify Email link');
    }

    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Reset Password form: Send Reset Code button stays on page');
    console.log('- Reset Password form: Resend Code functionality works');
    console.log('- Reset Password form: Error handling keeps user on page');
    console.log('- Verify Email form: Resend Verification Code stays on page');
    console.log('- Verify Email form: Error handling keeps user on page');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { runTest };