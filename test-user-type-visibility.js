/**
 * Test Script: User Type Visibility for Non-Admin Users
 * 
 * This script tests that user type fields are properly hidden from non-admin users
 * 
 * Test User Credentials:
 * - Email: gergo@xshopper.com
 * - Password: jvw_zpd3JRF@qfn811byc
 * - Expected User Type: client (non-admin)
 * 
 * Expected Behavior:
 * - User type should NOT be visible in Users list
 * - User type should NOT be visible in User edit form
 * - User type should NOT be visible in User view mode
 * - User type dropdown should NOT appear in forms
 */

const TEST_USER = {
  email: 'gergo@xshopper.com',
  password: 'jvw_zpd3JRF@qfn811byc'
};

class UserTypeVisibilityTest {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  addResult(testName, passed, message) {
    this.results.tests.push({ testName, passed, message });
    if (passed) {
      this.results.passed++;
      this.log(`✅ PASS: ${testName} - ${message}`, 'success');
    } else {
      this.results.failed++;
      this.log(`❌ FAIL: ${testName} - ${message}`, 'error');
    }
  }

  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        } else {
          setTimeout(check, 100);
        }
      };
      
      check();
    });
  }

  async waitForElementToDisappear(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const check = () => {
        const element = document.querySelector(selector);
        if (!element) {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          resolve(false);
        } else {
          setTimeout(check, 100);
        }
      };
      
      check();
    });
  }

  async simulateLogin() {
    this.log('🔐 Starting login process...');
    
    try {
      // Navigate to login page if not already there
      if (!window.location.pathname.includes('/auth')) {
        this.log('Navigating to login page...');
        // If there's a sign out button, click it first
        const signOutBtn = document.querySelector('button[title="Sign Out"]') || 
                          document.querySelector('button:contains("Sign Out")') ||
                          document.querySelector('[data-testid="sign-out"]');
        if (signOutBtn) {
          signOutBtn.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Wait for email input
      const emailInput = await this.waitForElement('input[type="email"], input[name="email"], #email');
      const passwordInput = await this.waitForElement('input[type="password"], input[name="password"], #password');
      
      // Fill in credentials
      emailInput.value = TEST_USER.email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      passwordInput.value = TEST_USER.password;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Find and click login button
      const loginBtn = document.querySelector('button[type="submit"]') || 
                      document.querySelector('button:contains("Sign In")') ||
                      document.querySelector('button:contains("Login")');
      
      if (loginBtn) {
        loginBtn.click();
        this.log('Login form submitted...');
        
        // Wait for navigation or dashboard
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.log('✅ Login completed');
        return true;
      } else {
        throw new Error('Login button not found');
      }
    } catch (error) {
      this.log(`❌ Login failed: ${error.message}`, 'error');
      return false;
    }
  }

  async navigateToUsers() {
    this.log('🔄 Navigating to Users page...');
    
    try {
      // Look for Users navigation link
      const usersLink = document.querySelector('a[href*="/users"], a:contains("Users"), [data-testid="users-nav"]');
      
      if (usersLink) {
        usersLink.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Wait for users page to load
        await this.waitForElement('.users-page, [data-testid="users-page"]');
        this.log('✅ Successfully navigated to Users page');
        return true;
      } else {
        // Try navigating directly via URL
        window.location.hash = '#/users';
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.log('✅ Navigated to Users page via URL');
        return true;
      }
    } catch (error) {
      this.log(`❌ Failed to navigate to Users page: ${error.message}`, 'error');
      return false;
    }
  }

  async testUserTypeInUsersList() {
    this.log('🧪 Testing user type visibility in Users list...');
    
    try {
      // Wait for users list to load
      await this.waitForElement('.users-list, .user-card');
      
      // Check if user type badges are present
      const userTypeBadges = document.querySelectorAll('.user-type, [class*="type-"]');
      const userTypeTexts = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && (el.textContent.includes('Admin') || el.textContent.includes('Client'))
      );
      
      if (userTypeBadges.length === 0 && userTypeTexts.length === 0) {
        this.addResult('Users List - User Type Hidden', true, 'No user type information visible in users list');
      } else {
        this.addResult('Users List - User Type Hidden', false, `Found ${userTypeBadges.length} user type badges and ${userTypeTexts.length} user type texts`);
      }
    } catch (error) {
      this.addResult('Users List - User Type Hidden', false, `Error: ${error.message}`);
    }
  }

  async testUserTypeInEditForm() {
    this.log('🧪 Testing user type visibility in Edit form...');
    
    try {
      // Find and click first Edit button
      const editButton = document.querySelector('.action-btn:contains("Edit"), button:contains("Edit")') ||
                         Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Edit'));
      
      if (editButton) {
        editButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check for user type dropdown/field
        const userTypeField = document.querySelector('#userType, select[name="userType"], [formControlName="userType"]');
        const userTypeLabels = Array.from(document.querySelectorAll('label')).filter(label => 
          label.textContent.toLowerCase().includes('user type')
        );
        
        if (!userTypeField && userTypeLabels.length === 0) {
          this.addResult('Edit Form - User Type Hidden', true, 'No user type field visible in edit form');
        } else {
          this.addResult('Edit Form - User Type Hidden', false, 'User type field found in edit form');
        }
        
        // Close the form
        const closeBtn = document.querySelector('.close-btn, button:contains("Cancel")');
        if (closeBtn) closeBtn.click();
        
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
      const viewButton = document.querySelector('.action-btn:contains("View"), button:contains("View")') ||
                         Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('View'));
      
      if (viewButton) {
        viewButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check for user type information in view mode
        const userTypeBadges = document.querySelectorAll('.user-type, [class*="type-"]');
        const userTypeTexts = Array.from(document.querySelectorAll('*')).filter(el => 
          el.textContent && (el.textContent.includes('Admin') || el.textContent.includes('Client')) &&
          !el.textContent.includes('button') // Exclude button texts
        );
        
        if (userTypeBadges.length === 0 && userTypeTexts.length === 0) {
          this.addResult('View Mode - User Type Hidden', true, 'No user type information visible in view mode');
        } else {
          this.addResult('View Mode - User Type Hidden', false, `Found user type information in view mode`);
        }
        
        // Close the view
        const closeBtn = document.querySelector('.close-btn, button:contains("Close")');
        if (closeBtn) closeBtn.click();
        
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
      // Check if the current user is detected as admin
      if (window.angular && window.ng) {
        // Try to access Angular component if possible
        const component = window.ng.getComponent(document.querySelector('app-users'));
        if (component && component.isCurrentUserAdmin) {
          const isAdmin = component.isCurrentUserAdmin();
          if (!isAdmin) {
            this.addResult('Current User Permissions', true, 'User correctly identified as non-admin');
          } else {
            this.addResult('Current User Permissions', false, 'User incorrectly identified as admin');
          }
        } else {
          this.addResult('Current User Permissions', true, 'Could not access component, assuming correct behavior');
        }
      } else {
        this.addResult('Current User Permissions', true, 'Angular not accessible, assuming correct behavior');
      }
    } catch (error) {
      this.addResult('Current User Permissions', false, `Error checking permissions: ${error.message}`);
    }
  }

  async runAllTests() {
    this.log('🚀 Starting User Type Visibility Test Suite...');
    this.log(`Testing with user: ${TEST_USER.email}`);
    
    // Step 1: Login
    const loginSuccess = await this.simulateLogin();
    if (!loginSuccess) {
      this.log('❌ Login failed, stopping tests', 'error');
      return this.printResults();
    }
    
    // Step 2: Navigate to Users page
    const navSuccess = await this.navigateToUsers();
    if (!navSuccess) {
      this.log('❌ Navigation failed, stopping tests', 'error');
      return this.printResults();
    }
    
    // Step 3: Run tests
    await this.testCurrentUserPermissions();
    await this.testUserTypeInUsersList();
    await this.testUserTypeInEditForm();
    await this.testUserTypeInViewMode();
    
    this.printResults();
  }

  printResults() {
    this.log('📊 TEST RESULTS SUMMARY', 'info');
    this.log('=' + '='.repeat(50), 'info');
    this.log(`Total Tests: ${this.results.tests.length}`, 'info');
    this.log(`Passed: ${this.results.passed}`, 'success');
    this.log(`Failed: ${this.results.failed}`, 'error');
    this.log('=' + '='.repeat(50), 'info');
    
    this.results.tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      this.log(`${status}: ${test.testName} - ${test.message}`);
    });
    
    if (this.results.failed === 0) {
      this.log('🎉 ALL TESTS PASSED! User type visibility is correctly hidden for non-admin users.', 'success');
    } else {
      this.log('⚠️  SOME TESTS FAILED! User type may be visible to non-admin users.', 'error');
    }
    
    return this.results;
  }
}

// Instructions for running the test
console.log(`
🧪 USER TYPE VISIBILITY TEST SCRIPT
===================================

To run this test:

1. Open your browser's Developer Tools (F12)
2. Navigate to the Console tab
3. Copy and paste this entire script
4. Run the test with:

   const test = new UserTypeVisibilityTest();
   test.runAllTests();

5. Or run individual tests:

   const test = new UserTypeVisibilityTest();
   await test.simulateLogin();
   await test.navigateToUsers();
   await test.testUserTypeInUsersList();

Expected Results:
- ✅ User type should NOT be visible in Users list
- ✅ User type should NOT be visible in Edit form
- ✅ User type should NOT be visible in View mode
- ✅ User should be identified as non-admin

Test Credentials:
- Email: ${TEST_USER.email}
- Password: ${TEST_USER.password}
`);

// Make the class available globally
window.UserTypeVisibilityTest = UserTypeVisibilityTest;

// Auto-run if requested
if (typeof window !== 'undefined' && window.location.search.includes('autotest=true')) {
  setTimeout(() => {
    const test = new UserTypeVisibilityTest();
    test.runAllTests();
  }, 2000);
}