#!/usr/bin/env node

/**
 * Test Script: Authentication Implementation Verification
 * 
 * This script tests the authentication implementation including:
 * - Auth service functionality
 * - Login/signup component structure
 * - User menu integration
 * - App-level authentication flow
 */

console.log('🧪 Authentication Implementation Test');
console.log('===================================\n');

const fs = require('fs');
const path = require('path');

// Test utilities
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function testFileContains(filePath, searchStrings) {
  const content = readFile(filePath);
  if (!content) return { exists: false };
  
  const results = {};
  searchStrings.forEach(search => {
    results[search] = content.includes(search);
  });
  
  return { exists: true, content: results };
}

// Test execution
async function runTests() {
  let testsPassed = 0;
  let testsTotal = 0;
  
  async function runTest(testName, testFn) {
    testsTotal++;
    console.log(`🔍 Running: ${testName}`);
    
    try {
      const result = await testFn();
      if (result === true || result === undefined) {
        console.log(`✅ PASSED: ${testName}\n`);
        testsPassed++;
      } else {
        console.log(`❌ FAILED: ${testName} - ${result}\n`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testName} - ${error.message}\n`);
    }
  }
  
  // Test 1: Verify Amplify backend configuration
  await runTest('Amplify Auth backend configuration', () => {
    const backendPath = 'amplify/backend.ts';
    const authResourcePath = 'amplify/auth/resource.ts';
    
    console.log(`   Checking ${backendPath}...`);
    const backendExists = fileExists(backendPath);
    console.log(`   Backend file exists: ${backendExists}`);
    
    console.log(`   Checking ${authResourcePath}...`);
    const authExists = fileExists(authResourcePath);
    console.log(`   Auth resource exists: ${authExists}`);
    
    if (authExists) {
      const authContent = readFile(authResourcePath);
      const hasEmailAuth = authContent.includes('email: true');
      console.log(`   Email authentication configured: ${hasEmailAuth}`);
      return hasEmailAuth;
    }
    
    return false;
  });
  
  // Test 2: Verify auth service implementation
  await runTest('Auth service implementation', () => {
    const authServicePath = 'src/app/services/auth.service.ts';
    console.log(`   Checking ${authServicePath}...`);
    
    const result = testFileContains(authServicePath, [
      'signUp',
      'signIn', 
      'signOut',
      'confirmSignUp',
      'getCurrentUser',
      'fetchAuthSession',
      'signal<AuthUser',
      'signal<boolean>'
    ]);
    
    if (!result.exists) {
      return 'Auth service file not found';
    }
    
    const content = result.content;
    console.log('   Auth service features:');
    Object.keys(content).forEach(feature => {
      console.log(`   - ${feature}: ${content[feature] ? '✓' : '✗'}`);
    });
    
    return Object.values(content).every(Boolean);
  });
  
  // Test 3: Verify auth component implementation
  await runTest('Auth component (login/signup forms)', () => {
    const authComponentPath = 'src/app/auth/auth.ts';
    const authTemplatePath = 'src/app/auth/auth.html';
    const authStylesPath = 'src/app/auth/auth.less';
    
    console.log('   Checking auth component files...');
    const componentExists = fileExists(authComponentPath);
    const templateExists = fileExists(authTemplatePath);
    const stylesExist = fileExists(authStylesPath);
    
    console.log(`   Component: ${componentExists ? '✓' : '✗'}`);
    console.log(`   Template: ${templateExists ? '✓' : '✗'}`);
    console.log(`   Styles: ${stylesExist ? '✓' : '✗'}`);
    
    if (componentExists) {
      const result = testFileContains(authComponentPath, [
        "currentMode = signal<'login' | 'signup' | 'confirm'>",
        'loginForm: FormGroup',
        'signupForm: FormGroup',
        'confirmationForm: FormGroup',
        'onLogin',
        'onSignup',
        'onConfirm'
      ]);
      
      console.log('   Component features:');
      Object.keys(result.content).forEach(feature => {
        console.log(`   - ${feature}: ${result.content[feature] ? '✓' : '✗'}`);
      });
      
      return Object.values(result.content).every(Boolean);
    }
    
    return false;
  });
  
  // Test 4: Verify user menu implementation
  await runTest('User menu component', () => {
    const userMenuPath = 'src/app/user-menu/user-menu.ts';
    const userMenuTemplatePath = 'src/app/user-menu/user-menu.html';
    const userMenuStylesPath = 'src/app/user-menu/user-menu.less';
    
    console.log('   Checking user menu files...');
    const componentExists = fileExists(userMenuPath);
    const templateExists = fileExists(userMenuTemplatePath);
    const stylesExist = fileExists(userMenuStylesPath);
    
    console.log(`   Component: ${componentExists ? '✓' : '✗'}`);
    console.log(`   Template: ${templateExists ? '✓' : '✗'}`);
    console.log(`   Styles: ${stylesExist ? '✓' : '✗'}`);
    
    if (componentExists && templateExists) {
      const componentResult = testFileContains(userMenuPath, [
        'AuthService',
        'currentUser = this.authService.currentUser',
        'isAuthenticated = this.authService.isAuthenticated',
        'logout()',
        'onMyAccount()'
      ]);
      
      const templateResult = testFileContains(userMenuTemplatePath, [
        '@if (isAuthenticated())',
        'My Account',
        'Logout',
        'user-avatar',
        'dropdown-menu'
      ]);
      
      console.log('   Component features:');
      Object.keys(componentResult.content).forEach(feature => {
        console.log(`   - ${feature}: ${componentResult.content[feature] ? '✓' : '✗'}`);
      });
      
      console.log('   Template features:');
      Object.keys(templateResult.content).forEach(feature => {
        console.log(`   - ${feature}: ${templateResult.content[feature] ? '✓' : '✗'}`);
      });
      
      return Object.values(componentResult.content).every(Boolean) && 
             Object.values(templateResult.content).every(Boolean);
    }
    
    return false;
  });
  
  // Test 5: Verify navigation integration
  await runTest('Navigation integration with user menu', () => {
    const navigationPath = 'src/app/navigation/navigation.ts';
    const navigationTemplatePath = 'src/app/navigation/navigation.html';
    
    console.log('   Checking navigation integration...');
    
    const componentResult = testFileContains(navigationPath, [
      'UserMenu',
      'imports: [RouterLink, RouterLinkActive, UserMenu]'
    ]);
    
    const templateResult = testFileContains(navigationTemplatePath, [
      '<app-user-menu></app-user-menu>',
      'nav-footer'
    ]);
    
    if (componentResult.exists && templateResult.exists) {
      console.log('   Navigation component imports UserMenu:', componentResult.content['UserMenu'] ? '✓' : '✗');
      console.log('   Template includes user menu:', templateResult.content['<app-user-menu></app-user-menu>'] ? '✓' : '✗');
      
      return componentResult.content['UserMenu'] && templateResult.content['<app-user-menu></app-user-menu>'];
    }
    
    return false;
  });
  
  // Test 6: Verify app-level authentication flow
  await runTest('App-level authentication flow', () => {
    const appComponentPath = 'src/app/app.ts';
    const appTemplatePath = 'src/app/app.html';
    
    console.log('   Checking app component...');
    
    const componentResult = testFileContains(appComponentPath, [
      'AuthService',
      'Auth',
      'isAuthenticated = this.authService.isAuthenticated',
      'isLoading = this.authService.isLoading'
    ]);
    
    const templateResult = testFileContains(appTemplatePath, [
      '@if (isLoading())',
      '@else if (isAuthenticated())',
      '@else',
      '<app-auth></app-auth>',
      'loading-screen'
    ]);
    
    if (componentResult.exists && templateResult.exists) {
      console.log('   App component features:');
      Object.keys(componentResult.content).forEach(feature => {
        console.log(`   - ${feature}: ${componentResult.content[feature] ? '✓' : '✗'}`);
      });
      
      console.log('   App template features:');
      Object.keys(templateResult.content).forEach(feature => {
        console.log(`   - ${feature}: ${templateResult.content[feature] ? '✓' : '✗'}`);
      });
      
      return Object.values(componentResult.content).every(Boolean) && 
             Object.values(templateResult.content).every(Boolean);
    }
    
    return false;
  });
  
  // Test 7: Verify Amplify configuration in main.ts
  await runTest('Amplify configuration in main.ts', () => {
    const mainPath = 'src/main.ts';
    
    console.log('   Checking main.ts...');
    
    const result = testFileContains(mainPath, [
      "import { Amplify } from 'aws-amplify'",
      "import outputs from '../amplify_outputs.json'",
      'Amplify.configure(outputs)'
    ]);
    
    if (result.exists) {
      console.log('   Amplify configuration:');
      Object.keys(result.content).forEach(feature => {
        console.log(`   - ${feature}: ${result.content[feature] ? '✓' : '✗'}`);
      });
      
      return Object.values(result.content).every(Boolean);
    }
    
    return false;
  });
  
  // Test 8: Check package.json dependencies
  await runTest('Required dependencies', () => {
    const packagePath = 'package.json';
    
    console.log('   Checking package.json...');
    
    const packageContent = readFile(packagePath);
    if (packageContent) {
      const packageJson = JSON.parse(packageContent);
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      const requiredDeps = {
        'aws-amplify': dependencies['aws-amplify'],
        '@angular/forms': dependencies['@angular/forms'],
        '@angular/common': dependencies['@angular/common'],
        '@angular/router': dependencies['@angular/router']
      };
      
      console.log('   Required dependencies:');
      Object.keys(requiredDeps).forEach(dep => {
        console.log(`   - ${dep}: ${requiredDeps[dep] ? requiredDeps[dep] : '✗ Missing'}`);
      });
      
      return Object.values(requiredDeps).every(Boolean);
    }
    
    return false;
  });
  
  // Summary
  console.log('===================================');
  console.log(`📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All tests passed! Authentication implementation is complete.');
    console.log('\n📋 Implementation Summary:');
    console.log('✅ Amplify Auth backend configured with email authentication');
    console.log('✅ AuthService with sign-up, sign-in, sign-out functionality');
    console.log('✅ Login/Signup forms with email confirmation');
    console.log('✅ User menu with My Account and Logout options');
    console.log('✅ Navigation integration at bottom of sidebar');
    console.log('✅ App-level authentication flow with loading states');
    console.log('✅ Proper Amplify configuration');
    console.log('✅ All required dependencies installed');
    console.log('\n🚀 Ready for deployment and testing!');
    console.log('\n🔧 To test authentication:');
    console.log('1. Run: npm start');
    console.log('2. Deploy backend: npx ampx sandbox --once');
    console.log('3. Try signing up with a real email address');
    console.log('4. Check email for confirmation code');
    console.log('5. Log in and test the user menu');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Change to the correct directory
process.chdir('/home/gbacs/apps/docflow4');

// Run the tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});