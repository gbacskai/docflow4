#!/usr/bin/env node

/**
 * Test script for Send Reset Code and Resend Verification Code functionality
 * Tests that clicking these buttons stays on the same page and handles errors properly
 */

const puppeteer = require('puppeteer');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:4200',
  headless: true, // Set to true for CI/headless testing
  timeout: 10000,
  testEmail: 'test-reset@example.com',
  invalidEmail: 'invalid-email-format',
  nonExistentEmail: 'nonexistent@example.com'
};

class AuthTestRunner {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = [];
  }

  async initialize() {
    console.log('🚀 Initializing browser...');
    this.browser = await puppeteer.launch({
      headless: TEST_CONFIG.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1200, height: 800 }
    });
    this.page = await this.browser.newPage();
    
    // Listen for console logs to track component behavior
    this.page.on('console', msg => {
      if (msg.text().includes('🔐')) {
        console.log('🔐 App Log:', msg.text());
      }
    });
    
    // Listen for errors
    this.page.on('pageerror', error => {
      console.error('❌ Page Error:', error.message);
    });

    await this.page.goto(TEST_CONFIG.baseUrl);
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async logResult(testName, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName} ${details}`);
    this.testResults.push({ testName, passed, details });
  }

  async waitForElement(selector, timeout = TEST_CONFIG.timeout) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      console.log(`⏰ Timeout waiting for ${selector}`);
      return false;
    }
  }

  async getCurrentAuthMode() {
    return await this.page.evaluate(() => {
      // Check which form is currently visible and get detailed info
      const loginForm = document.querySelector('[data-test="login-form"]');
      const signupForm = document.querySelector('[data-test="signup-form"]');
      const verifyForm = document.querySelector('[data-test="verify-form"]');
      const resetForm = document.querySelector('[data-test="reset-form"]');
      
      // Check for separate page indicators
      const signupPage = document.querySelector('[data-test="signup-page"]');
      const verifyPage = document.querySelector('[data-test="verify-page"]');
      const resetPasswordPage = document.querySelector('[data-test="reset-password-page"]');
      
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const h1Text = h1?.textContent || '';
      const h2Text = h2?.textContent || '';
      const currentUrl = window.location.href;
      
      console.log('🔍 Auth form detection:', {
        loginForm: !!loginForm,
        signupForm: !!signupForm, 
        verifyForm: !!verifyForm,
        resetForm: !!resetForm,
        signupPage: !!signupPage,
        verifyPage: !!verifyPage,
        resetPasswordPage: !!resetPasswordPage,
        h1Text: h1Text,
        h2Text: h2Text,
        currentUrl: currentUrl
      });
      
      // Check for separate pages first
      if (signupPage || h1Text.includes('Create Your Account') || currentUrl.includes('/signup')) {
        return 'signup';
      }
      if (verifyPage || h1Text.includes('Verify Your Email') || currentUrl.includes('/verify')) {
        return 'verify';
      }
      if (resetPasswordPage || h1Text.includes('Reset Your Password') || currentUrl.includes('/reset-password')) {
        return 'reset';
      }
      
      // Fallback to old form detection
      if (loginForm || h2Text.includes('Welcome Back')) {
        return 'login';
      }
      if (signupForm || h2Text.includes('Create Account')) {
        return 'signup';
      }
      if (verifyForm || h2Text.includes('Verify Your Email')) {
        return 'verify';
      }
      if (resetForm || h2Text.includes('Reset Password')) {
        return 'reset';
      }
      
      return 'unknown';
    });
  }

  async navigateToResetPassword() {
    console.log('📱 Navigating to Reset Password page...');
    
    // Go directly to the reset-password page
    await this.page.goto(`${TEST_CONFIG.baseUrl}/reset-password`);
    await this.page.waitForSelector('h1', { timeout: 5000 });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const currentMode = await this.getCurrentAuthMode();
    await this.logResult('Navigate to Reset Password', currentMode === 'reset', 
                        `Current mode: ${currentMode}`);
    
    return currentMode === 'reset';
  }

  async navigateToVerifyEmail() {
    console.log('📱 Navigating to Verify Email page...');
    
    // Go directly to the verify page
    await this.page.goto(`${TEST_CONFIG.baseUrl}/verify`);
    await this.page.waitForSelector('h1', { timeout: 5000 });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const currentMode = await this.getCurrentAuthMode();
    await this.logResult('Navigate to Verify Email', currentMode === 'verify', 
                        `Current mode: ${currentMode}`);
    
    return currentMode === 'verify';
  }

  async testResetPasswordStaysOnPage() {
    console.log('\n🧪 Testing Reset Password - Stay on Page...');
    
    if (!await this.navigateToResetPassword()) {
      await this.logResult('Reset Password Navigation', false, 'Could not navigate to reset form');
      return;
    }

    // Test 1: Valid email - should stay on page and show success
    console.log('Test 1: Valid email input');
    await this.page.focus('input[type="email"]');
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA'); 
    await this.page.keyboard.up('Control');
    await this.page.type('input[type="email"]', TEST_CONFIG.testEmail);
    
    // Click Send Reset Code button
    const buttonClicked = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const sendButton = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('send reset code')
      );
      if (sendButton) {
        sendButton.click();
        return true;
      }
      return false;
    });
    
    if (buttonClicked) {
      const initialMode = await this.getCurrentAuthMode();
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalMode = await this.getCurrentAuthMode();
      const stayedOnPage = initialMode === finalMode && finalMode === 'reset';
      
      await this.logResult('Reset Code - Valid Email Stays on Page', stayedOnPage, 
                          `${initialMode} -> ${finalMode}`);
      
      // Check if success message appeared
      const hasSuccessMessage = await this.page.$('.alert-success') !== null;
      await this.logResult('Reset Code - Success Message Shown', hasSuccessMessage);
      
      // Check if additional fields appeared (code, new password)
      const hasCodeField = await this.page.$('input[placeholder*="reset code"]') !== null ||
                          await this.page.$('input[placeholder*="6-digit"]') !== null;
      await this.logResult('Reset Code - Additional Fields Appeared', hasCodeField);
      
      // Check if "Send Reset Code" button is still visible
      const sendButtonStillVisible = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent.toLowerCase().includes('send reset code'));
      });
      await this.logResult('Reset Code - Send Reset Code Button Still Visible', sendButtonStillVisible);
      
      // Check if button text changed to "Resend Code"
      const hasResendButton = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent.toLowerCase().includes('resend'));
      });
      await this.logResult('Reset Code - Button Text Changed to Resend', hasResendButton);
      
      // Test resend functionality
      if (hasResendButton) {
        console.log('Test 1b: Testing Resend Code functionality');
        const beforeResend = await this.getCurrentAuthMode();
        
        const resendClicked = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const resendButton = buttons.find(btn => 
            btn.textContent.toLowerCase().includes('resend')
          );
          if (resendButton) {
            resendButton.click();
            return true;
          }
          return false;
        });
        
        if (resendClicked) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const afterResend = await this.getCurrentAuthMode();
          
          const stayedOnPageAfterResend = beforeResend === afterResend && afterResend === 'reset';
          await this.logResult('Resend Code - Stays on Page', stayedOnPageAfterResend,
                              `${beforeResend} -> ${afterResend}`);
        }
      }
    } else {
      await this.logResult('Reset Code - Find Send Button', false, 'Could not find Send Reset Code button');
    }

    // Test 2: Invalid email format - should stay on page and show error
    console.log('Test 2: Invalid email format');
    await this.page.focus('input[type="email"]');
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA'); 
    await this.page.keyboard.up('Control');
    await this.page.type('input[type="email"]', TEST_CONFIG.invalidEmail);
    
    const buttonClicked2 = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const sendButton = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('send reset code')
      );
      if (sendButton) {
        sendButton.click();
        return true;
      }
      return false;
    });
    
    if (buttonClicked2) {
      const initialMode = await this.getCurrentAuthMode();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalMode = await this.getCurrentAuthMode();
      const stayedOnPage = initialMode === finalMode && finalMode === 'reset';
      
      await this.logResult('Reset Code - Invalid Email Stays on Page', stayedOnPage,
                          `${initialMode} -> ${finalMode}`);
      
      // Check if "Send Reset Code" button is still visible after error
      const sendButtonVisible = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent.toLowerCase().includes('send reset code'));
      });
      await this.logResult('Reset Code - Send Button Still Visible After Invalid Email', sendButtonVisible);
      
      // Check for error message
      const hasErrorMessage = await this.page.$('.alert-error') !== null ||
                             await this.page.$('.error-message') !== null;
      await this.logResult('Reset Code - Invalid Email Shows Error', hasErrorMessage);
    }

    // Test 3: Empty email - should stay on page and show error
    console.log('Test 3: Empty email');
    await this.page.focus('input[type="email"]');
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA'); 
    await this.page.keyboard.up('Control');
    await this.page.type('input[type="email"]', '');
    
    const buttonClicked3 = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const sendButton = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('send reset code')
      );
      if (sendButton) {
        sendButton.click();
        return true;
      }
      return false;
    });
    
    if (buttonClicked3) {
      const initialMode = await this.getCurrentAuthMode();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalMode = await this.getCurrentAuthMode();
      const stayedOnPage = initialMode === finalMode && finalMode === 'reset';
      
      await this.logResult('Reset Code - Empty Email Stays on Page', stayedOnPage,
                          `${initialMode} -> ${finalMode}`);
      
      // Check if "Send Reset Code" button is still visible after empty email error
      const sendButtonVisible = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent.toLowerCase().includes('send reset code'));
      });
      await this.logResult('Reset Code - Send Button Still Visible After Empty Email', sendButtonVisible);
      
      const hasErrorMessage = await this.page.$('.alert-error') !== null ||
                             await this.page.$('.error-message') !== null;
      await this.logResult('Reset Code - Empty Email Shows Error', hasErrorMessage);
    }
  }

  async testVerifyEmailStaysOnPage() {
    console.log('\n🧪 Testing Verify Email - Stay on Page...');
    
    if (!await this.navigateToVerifyEmail()) {
      await this.logResult('Verify Email Navigation', false, 'Could not navigate to verify form');
      return;
    }

    // Test 1: Valid email - should stay on page
    console.log('Test 1: Valid email input for verification');
    await this.page.focus('input[type="email"]');
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA'); 
    await this.page.keyboard.up('Control');
    await this.page.type('input[type="email"]', TEST_CONFIG.testEmail);
    
    const resendClicked = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const resendButton = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('resend')
      );
      if (resendButton) {
        resendButton.click();
        return true;
      }
      return false;
    });
    
    if (resendClicked) {
      const initialMode = await this.getCurrentAuthMode();
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalMode = await this.getCurrentAuthMode();
      const stayedOnPage = initialMode === finalMode && finalMode === 'verify';
      
      await this.logResult('Verify Email - Resend Code Stays on Page', stayedOnPage,
                          `${initialMode} -> ${finalMode}`);
      
      // Check for success message
      const hasMessage = await this.page.$('.alert-success') !== null ||
                         await this.page.evaluate(() => {
                           return Array.from(document.querySelectorAll('div')).some(div => 
                             div.textContent.toLowerCase().includes('sent a code')
                           );
                         });
      await this.logResult('Verify Email - Resend Code Shows Message', hasMessage);
    } else {
      await this.logResult('Verify Email - Find Resend Button', false, 'Could not find Resend Code button');
    }

    // Test 2: Empty email - should stay on page and show error
    console.log('Test 2: Empty email for verification');
    await this.page.focus('input[type="email"]');
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA'); 
    await this.page.keyboard.up('Control');
    await this.page.type('input[type="email"]', '');
    
    const resendClicked2 = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const resendButton = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('resend')
      );
      if (resendButton) {
        resendButton.click();
        return true;
      }
      return false;
    });
    
    if (resendClicked2) {
      const initialMode = await this.getCurrentAuthMode();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalMode = await this.getCurrentAuthMode();
      const stayedOnPage = initialMode === finalMode && finalMode === 'verify';
      
      await this.logResult('Verify Email - Empty Email Stays on Page', stayedOnPage,
                          `${initialMode} -> ${finalMode}`);
      
      const hasErrorMessage = await this.page.$('.alert-error') !== null ||
                             await this.page.$('.error-message') !== null;
      await this.logResult('Verify Email - Empty Email Shows Error', hasErrorMessage);
    }
  }

  async runAllTests() {
    try {
      await this.initialize();
      
      console.log('🧪 Starting Send Reset Code Tests...\n');
      
      await this.testResetPasswordStaysOnPage();
      await this.testVerifyEmailStaysOnPage();
      
      // Summary
      console.log('\n📊 Test Summary:');
      console.log('================');
      
      const passed = this.testResults.filter(r => r.passed).length;
      const total = this.testResults.length;
      const failed = this.testResults.filter(r => !r.passed);
      
      console.log(`Total Tests: ${total}`);
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${total - passed}`);
      
      if (failed.length > 0) {
        console.log('\n❌ Failed Tests:');
        failed.forEach(test => {
          console.log(`  - ${test.testName}: ${test.details}`);
        });
      }
      
      const successRate = Math.round((passed / total) * 100);
      console.log(`\nSuccess Rate: ${successRate}%`);
      
      if (successRate === 100) {
        console.log('🎉 All tests passed!');
      } else if (successRate >= 80) {
        console.log('⚠️  Most tests passed, but some issues detected.');
      } else {
        console.log('❌ Many tests failed. Please review the implementation.');
      }
      
    } catch (error) {
      console.error('💥 Test execution failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if script is called directly
if (require.main === module) {
  const testRunner = new AuthTestRunner();
  testRunner.runAllTests().catch(console.error);
}

module.exports = AuthTestRunner;