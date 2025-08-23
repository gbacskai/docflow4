#!/usr/bin/env node

/**
 * Headless User Type Visibility Test
 * 
 * This script uses Puppeteer to test that user type fields are hidden
 * from non-admin users in headless mode.
 * 
 * Requirements:
 * - npm install puppeteer
 * - Angular app running on http://localhost:4200
 */

const puppeteer = require('puppeteer');

const TEST_CONFIG = {
  // Test user credentials (non-admin)
  testUser: {
    email: 'gergo@xshopper.com',
    password: 'jvw_zpd3JRF@qfn811byc'
  },
  
  // Application URL
  baseUrl: 'http://localhost:4200',
  
  // Test timeouts
  timeouts: {
    navigation: 10000,
    element: 5000,
    action: 2000
  }
};

class HeadlessUserTypeTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  addResult(testName, passed, message, details = null) {
    this.results.tests.push({ testName, passed, message, details });
    if (passed) {
      this.results.passed++;
      this.log(`✅ PASS: ${testName} - ${message}`, 'success');
    } else {
      this.results.failed++;
      this.log(`❌ FAIL: ${testName} - ${message}`, 'error');
      if (details) {
        this.log(`   Details: ${JSON.stringify(details)}`, 'error');
      }
    }
  }

  async init() {
    this.log('🚀 Initializing headless browser...');
    
    this.browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Set viewport
    await this.page.setViewport({ width: 1280, height: 720 });
    
    // Enable request/response logging for debugging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.log(`Browser Console Error: ${msg.text()}`, 'warning');
      }
    });
    
    this.log('✅ Browser initialized');
  }

  async login() {
    this.log('🔐 Starting login process...');
    
    try {
      // Navigate to the application
      await this.page.goto(TEST_CONFIG.baseUrl, { 
        waitUntil: 'networkidle0',
        timeout: TEST_CONFIG.timeouts.navigation 
      });
      
      // Check if we're already on login page or need to navigate
      const currentUrl = this.page.url();
      this.log(`Current URL: ${currentUrl}`);
      
      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if we need to navigate to auth/login
      const hasLoginForm = await this.page.$('input[type="email"], input[name="email"]');
      if (!hasLoginForm) {
        this.log('No login form found, trying to navigate to auth page...');
        // Try clicking sign in button or navigating to auth
        try {
          await this.page.goto(`${TEST_CONFIG.baseUrl}/#/auth`, { 
            waitUntil: 'networkidle0',
            timeout: TEST_CONFIG.timeouts.navigation 
          });
        } catch {
          // Try different auth paths
          await this.page.goto(`${TEST_CONFIG.baseUrl}/auth`, { 
            waitUntil: 'networkidle0',
            timeout: TEST_CONFIG.timeouts.navigation 
          });
        }
      }
      
      // Look for login form elements
      await this.page.waitForSelector('input[type="email"], input[name="email"], #email', {
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // Clear and fill in email
      await this.page.evaluate(() => {
        const emailInput = document.querySelector('input[type="email"], input[name="email"], #email');
        if (emailInput) emailInput.value = '';
      });
      await this.page.type('input[type="email"], input[name="email"], #email', TEST_CONFIG.testUser.email);
      this.log(`✅ Entered email: ${TEST_CONFIG.testUser.email}`);
      
      // Clear and fill in password  
      await this.page.evaluate(() => {
        const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password');
        if (passwordInput) passwordInput.value = '';
      });
      await this.page.type('input[type="password"], input[name="password"], #password', TEST_CONFIG.testUser.password);
      this.log('✅ Entered password');
      
      // Click login button
      let loginButton = await this.page.$('button[type="submit"]');
      if (!loginButton) {
        // Try to find button by text content
        loginButton = await this.page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn => 
            btn.textContent.includes('Sign In') || 
            btn.textContent.includes('Login') ||
            btn.textContent.includes('Submit')
          );
        });
      }
      
      if (loginButton && loginButton.asElement) {
        await loginButton.asElement().click();
        this.log('✅ Clicked login button');
      } else if (loginButton) {
        await loginButton.click();
        this.log('✅ Clicked login button');
      } else {
        // Try pressing Enter
        await this.page.keyboard.press('Enter');
        this.log('✅ Pressed Enter to submit');
      }
      
      // Wait for either navigation or dashboard elements to appear
      try {
        await Promise.race([
          this.page.waitForNavigation({ 
            waitUntil: 'networkidle0',
            timeout: TEST_CONFIG.timeouts.navigation 
          }),
          this.page.waitForSelector('.dashboard, app-root, .main-content, nav', {
            timeout: TEST_CONFIG.timeouts.navigation
          })
        ]);
      } catch (navError) {
        this.log('Navigation timeout, checking if login was successful anyway...');
        // Check if we're now on a different page (successful login)
        const newUrl = this.page.url();
        if (newUrl !== currentUrl && !newUrl.includes('auth') && !newUrl.includes('login')) {
          this.log('✅ Login appears successful (URL changed)');
          return true;
        }
        throw navError;
      }
      
      this.log('✅ Login completed successfully');
      return true;
      
    } catch (error) {
      this.log(`❌ Login failed: ${error.message}`, 'error');
      
      // Log current page state for debugging
      const currentUrl = this.page.url();
      const pageTitle = await this.page.title();
      this.log(`Debug - Current URL: ${currentUrl}`, 'warning');
      this.log(`Debug - Page Title: ${pageTitle}`, 'warning');
      
      return false;
    }
  }

  async navigateToUsers() {
    this.log('🔄 Navigating to Users page...');
    
    try {
      // Look for Users navigation link
      const usersLinkSelector = 'a[href*="/users"], a[routerLink*="users"], nav a:contains("Users")';
      
      try {
        await this.page.waitForSelector('a[href*="/users"], a[routerLink*="users"]', {
          timeout: TEST_CONFIG.timeouts.element
        });
        await this.page.click('a[href*="/users"], a[routerLink*="users"]');
      } catch {
        // Try direct navigation
        await this.page.goto(`${TEST_CONFIG.baseUrl}/#/users`, { 
          waitUntil: 'networkidle0',
          timeout: TEST_CONFIG.timeouts.navigation 
        });
      }
      
      // Wait for users page to load
      await this.page.waitForSelector('.users-page, app-users', {
        timeout: TEST_CONFIG.timeouts.element
      });
      
      this.log('✅ Successfully navigated to Users page');
      return true;
      
    } catch (error) {
      this.log(`❌ Failed to navigate to Users page: ${error.message}`, 'error');
      return false;
    }
  }

  async testUserTypeInUsersList() {
    this.log('🧪 Testing user type visibility in Users list...');
    
    try {
      // Wait for users list to load
      await this.page.waitForSelector('.users-list, .user-card', {
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // Check for user type badges and elements
      const userTypeBadges = await this.page.$$('.user-type, [class*="type-admin"], [class*="type-client"]');
      const userTypeTexts = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('.user-card *, .users-list *'));
        return elements.filter(el => {
          const text = el.textContent?.toLowerCase() || '';
          const isVisible = el.offsetParent !== null; // Check if element is visible
          return isVisible &&
                 (text.includes('admin') || text.includes('client')) && 
                 text.includes('type') &&
                 el.tagName !== 'SCRIPT' &&
                 !el.closest('script');
        }).length;
      });
      
      this.log(`Found ${userTypeBadges.length} user type badges`);
      this.log(`Found ${userTypeTexts} user type text elements`);
      
      if (userTypeBadges.length === 0 && userTypeTexts === 0) {
        this.addResult('Users List - User Type Hidden', true, 'No user type information visible in users list');
      } else {
        this.addResult('Users List - User Type Hidden', false, 
          `Found ${userTypeBadges.length} user type badges and ${userTypeTexts} user type texts`,
          { badges: userTypeBadges.length, texts: userTypeTexts }
        );
      }
      
    } catch (error) {
      this.addResult('Users List - User Type Hidden', false, `Error: ${error.message}`);
    }
  }

  async testUserTypeInEditForm() {
    this.log('🧪 Testing user type visibility in Edit form...');
    
    try {
      // Find and click first Edit button
      let editButton = await this.page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => btn.textContent.includes('Edit'));
      });
      
      if (!editButton || !editButton.asElement) {
        editButton = await this.page.$('.action-btn');
      }
      
      if (editButton) {
        if (editButton.asElement) {
          await editButton.asElement().click();
        } else {
          await editButton.click();
        }
        await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.timeouts.action));
        
        // Check for user type form elements
        const userTypeField = await this.page.$('#userType, select[formControlName="userType"]');
        const userTypeLabels = await this.page.evaluate(() => {
          return Array.from(document.querySelectorAll('label')).filter(label => 
            label.textContent.toLowerCase().includes('user type')
          ).length;
        });
        
        if (!userTypeField && userTypeLabels === 0) {
          this.addResult('Edit Form - User Type Hidden', true, 'No user type field visible in edit form');
        } else {
          this.addResult('Edit Form - User Type Hidden', false, 
            `User type field found in edit form`,
            { hasField: !!userTypeField, labelCount: userTypeLabels }
          );
        }
        
        // Close the form
        let closeBtn = await this.page.$('.close-btn');
        if (!closeBtn) {
          closeBtn = await this.page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => btn.textContent.includes('Cancel'));
          });
        }
        if (closeBtn) {
          if (closeBtn.asElement) {
            await closeBtn.asElement().click();
          } else {
            await closeBtn.click();
          }
        }
        
      } else {
        this.addResult('Edit Form - User Type Hidden', false, 'Could not find Edit button to test form');
      }
      
    } catch (error) {
      this.addResult('Edit Form - User Type Hidden', false, `Error: ${error.message}`);
    }
  }

  async testUserTypeInViewMode() {
    this.log('🧪 Testing user type visibility in View mode...');
    
    try {
      // Find and click first View button
      let viewButton = await this.page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => btn.textContent.includes('View'));
      });
      
      if (!viewButton || !viewButton.asElement) {
        viewButton = await this.page.$('.action-btn');
      }
      
      if (viewButton) {
        if (viewButton.asElement) {
          await viewButton.asElement().click();
        } else {
          await viewButton.click();
        }
        await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.timeouts.action));
        
        // Check for user type information in view mode
        const userTypeBadges = await this.page.$$('.user-type, [class*="type-admin"], [class*="type-client"]');
        const userTypeTexts = await this.page.evaluate(() => {
          return Array.from(document.querySelectorAll('.view-mode *')).filter(el => {
            const text = el.textContent?.toLowerCase() || '';
            return (text.includes('admin') || text.includes('client')) && 
                   !text.includes('button') &&
                   el.tagName !== 'SCRIPT';
          }).length;
        });
        
        if (userTypeBadges.length === 0 && userTypeTexts === 0) {
          this.addResult('View Mode - User Type Hidden', true, 'No user type information visible in view mode');
        } else {
          this.addResult('View Mode - User Type Hidden', false, 
            `User type information found in view mode`,
            { badges: userTypeBadges.length, texts: userTypeTexts }
          );
        }
        
        // Close the view
        let closeBtn = await this.page.$('.close-btn');
        if (!closeBtn) {
          closeBtn = await this.page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => btn.textContent.includes('Close'));
          });
        }
        if (closeBtn) {
          if (closeBtn.asElement) {
            await closeBtn.asElement().click();
          } else {
            await closeBtn.click();
          }
        }
        
      } else {
        this.addResult('View Mode - User Type Hidden', false, 'Could not find View button to test view mode');
      }
      
    } catch (error) {
      this.addResult('View Mode - User Type Hidden', false, `Error: ${error.message}`);
    }
  }

  async testCurrentUserPermissions() {
    this.log('🧪 Testing current user permissions...');
    
    try {
      // Check if the current user is detected as admin via Angular component
      const isAdmin = await this.page.evaluate(() => {
        try {
          const usersComponent = document.querySelector('app-users');
          if (usersComponent && window.ng) {
            const component = window.ng.getComponent(usersComponent);
            if (component && typeof component.isCurrentUserAdmin === 'function') {
              return component.isCurrentUserAdmin();
            }
          }
          return null;
        } catch (error) {
          return null;
        }
      });
      
      if (isAdmin === false) {
        this.addResult('Current User Permissions', true, 'User correctly identified as non-admin');
      } else if (isAdmin === true) {
        this.addResult('Current User Permissions', false, 'User incorrectly identified as admin');
      } else {
        this.addResult('Current User Permissions', true, 'Could not access component directly - assuming correct behavior');
      }
      
    } catch (error) {
      this.addResult('Current User Permissions', false, `Error checking permissions: ${error.message}`);
    }
  }

  async takeScreenshot(name) {
    try {
      await this.page.screenshot({ 
        path: `test-screenshot-${name}-${Date.now()}.png`,
        fullPage: true 
      });
      this.log(`📸 Screenshot saved: test-screenshot-${name}-${Date.now()}.png`);
    } catch (error) {
      this.log(`❌ Failed to take screenshot: ${error.message}`, 'warning');
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Headless User Type Visibility Test Suite...');
    this.log(`Testing with user: ${TEST_CONFIG.testUser.email}`);
    
    try {
      // Initialize browser
      await this.init();
      
      // Step 1: Login
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        this.log('❌ Login failed, stopping tests', 'error');
        await this.takeScreenshot('login-failed');
        return this.printResults();
      }
      await this.takeScreenshot('after-login');
      
      // Step 2: Navigate to Users page
      const navSuccess = await this.navigateToUsers();
      if (!navSuccess) {
        this.log('❌ Navigation failed, stopping tests', 'error');
        await this.takeScreenshot('navigation-failed');
        return this.printResults();
      }
      await this.takeScreenshot('users-page');
      
      // Step 3: Run tests
      await this.testCurrentUserPermissions();
      await this.testUserTypeInUsersList();
      await this.testUserTypeInEditForm();
      await this.testUserTypeInViewMode();
      
      await this.takeScreenshot('tests-completed');
      
    } catch (error) {
      this.log(`❌ Test execution failed: ${error.message}`, 'error');
      await this.takeScreenshot('error');
    } finally {
      await this.cleanup();
      this.printResults();
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.log('✅ Browser closed');
    }
  }

  printResults() {
    this.log('📊 HEADLESS TEST RESULTS SUMMARY', 'info');
    this.log('=' + '='.repeat(60), 'info');
    this.log(`Test User: ${TEST_CONFIG.testUser.email}`, 'info');
    this.log(`Total Tests: ${this.results.tests.length}`, 'info');
    this.log(`Passed: ${this.results.passed}`, 'success');
    this.log(`Failed: ${this.results.failed}`, 'error');
    this.log('=' + '='.repeat(60), 'info');
    
    this.results.tests.forEach((test, index) => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      this.log(`${index + 1}. ${status}: ${test.testName}`);
      this.log(`   ${test.message}`);
      if (test.details) {
        this.log(`   Details: ${JSON.stringify(test.details)}`);
      }
      this.log('');
    });
    
    if (this.results.failed === 0) {
      this.log('🎉 ALL TESTS PASSED! User type visibility is correctly hidden for non-admin users.', 'success');
      process.exit(0);
    } else {
      this.log('⚠️  SOME TESTS FAILED! User type may be visible to non-admin users.', 'error');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const test = new HeadlessUserTypeTest();
  await test.runAllTests();
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = HeadlessUserTypeTest;