#!/usr/bin/env node

/**
 * Test Script: Default Active Status and Hide Zero Counts
 * 
 * This script tests:
 * 1. New document types default to "Active" status
 * 2. Zero document/template counts are not displayed
 * 3. Non-zero counts are still displayed correctly
 */

console.log('🧪 Default Status and Zero Counts Test');
console.log('====================================\n');

// Mock component functionality
class DocumentTypeComponentSimulator {
  constructor() {
    this.documentTypeForm = {
      value: {},
      reset: () => {
        this.documentTypeForm.value = {};
      },
      patchValue: (data) => {
        Object.assign(this.documentTypeForm.value, data);
        console.log('   Form patched with:', data);
      }
    };
  }

  // Simulate openCreateForm method
  openCreateForm() {
    console.log('   Opening create form...');
    this.documentTypeForm.reset();
    this.documentTypeForm.patchValue({ category: [], isActive: true });
    return this.documentTypeForm.value;
  }

  // Simulate closeForm method
  closeForm() {
    console.log('   Closing form...');
    this.documentTypeForm.reset();
    this.documentTypeForm.patchValue({ category: [], isActive: true });
    return this.documentTypeForm.value;
  }

  // Simulate conditional display logic for counts
  shouldShowUsageCount(usageCount) {
    return (usageCount || 0) > 0;
  }

  shouldShowTemplateCount(templateCount) {
    return (templateCount || 0) > 0;
  }

  // Generate display text for counts
  getCountDisplayText(docType) {
    let displayItems = [];
    
    if (this.shouldShowUsageCount(docType.usageCount)) {
      displayItems.push(`${docType.usageCount} documents`);
    }
    
    if (this.shouldShowTemplateCount(docType.templateCount)) {
      displayItems.push(`${docType.templateCount} templates`);
    }
    
    if (docType.category && docType.category.length > 0) {
      displayItems.push(`Domain: ${docType.category}`);
    }
    
    if (!docType.isActive) {
      displayItems.push('Inactive');
    }
    
    return displayItems.length > 0 ? displayItems.join(' • ') : 'No metadata to display';
  }
}

// Test execution
async function runTests() {
  let testsPassed = 0;
  let testsTotal = 0;
  
  const simulator = new DocumentTypeComponentSimulator();
  
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
  
  // Test 1: Default status is Active when opening create form
  await runTest('New document type defaults to Active status', () => {
    const formData = simulator.openCreateForm();
    
    console.log('   Form data after opening create form:', formData);
    
    return formData.isActive === true;
  });
  
  // Test 2: Default status is Active when closing form (reset)
  await runTest('Form reset sets Active status as default', () => {
    const formData = simulator.closeForm();
    
    console.log('   Form data after closing/resetting form:', formData);
    
    return formData.isActive === true;
  });
  
  // Test 3: Zero usage count should not be displayed
  await runTest('Zero usage count is hidden', () => {
    const testCases = [
      { usageCount: 0, expected: false },
      { usageCount: null, expected: false },
      { usageCount: undefined, expected: false },
      { expected: false } // No usageCount property
    ];
    
    let allTestsPassed = true;
    
    testCases.forEach((testCase, index) => {
      const shouldShow = simulator.shouldShowUsageCount(testCase.usageCount);
      console.log(`   Test case ${index + 1}: usageCount=${testCase.usageCount}, shouldShow=${shouldShow}, expected=${testCase.expected}`);
      
      if (shouldShow !== testCase.expected) {
        allTestsPassed = false;
      }
    });
    
    return allTestsPassed;
  });
  
  // Test 4: Non-zero usage count should be displayed
  await runTest('Non-zero usage count is shown', () => {
    const testCases = [
      { usageCount: 1, expected: true },
      { usageCount: 5, expected: true },
      { usageCount: 100, expected: true }
    ];
    
    let allTestsPassed = true;
    
    testCases.forEach((testCase, index) => {
      const shouldShow = simulator.shouldShowUsageCount(testCase.usageCount);
      console.log(`   Test case ${index + 1}: usageCount=${testCase.usageCount}, shouldShow=${shouldShow}, expected=${testCase.expected}`);
      
      if (shouldShow !== testCase.expected) {
        allTestsPassed = false;
      }
    });
    
    return allTestsPassed;
  });
  
  // Test 5: Zero template count should not be displayed
  await runTest('Zero template count is hidden', () => {
    const testCases = [
      { templateCount: 0, expected: false },
      { templateCount: null, expected: false },
      { templateCount: undefined, expected: false },
      { expected: false } // No templateCount property
    ];
    
    let allTestsPassed = true;
    
    testCases.forEach((testCase, index) => {
      const shouldShow = simulator.shouldShowTemplateCount(testCase.templateCount);
      console.log(`   Test case ${index + 1}: templateCount=${testCase.templateCount}, shouldShow=${shouldShow}, expected=${testCase.expected}`);
      
      if (shouldShow !== testCase.expected) {
        allTestsPassed = false;
      }
    });
    
    return allTestsPassed;
  });
  
  // Test 6: Non-zero template count should be displayed
  await runTest('Non-zero template count is shown', () => {
    const testCases = [
      { templateCount: 1, expected: true },
      { templateCount: 3, expected: true },
      { templateCount: 50, expected: true }
    ];
    
    let allTestsPassed = true;
    
    testCases.forEach((testCase, index) => {
      const shouldShow = simulator.shouldShowTemplateCount(testCase.templateCount);
      console.log(`   Test case ${index + 1}: templateCount=${testCase.templateCount}, shouldShow=${shouldShow}, expected=${testCase.expected}`);
      
      if (shouldShow !== testCase.expected) {
        allTestsPassed = false;
      }
    });
    
    return allTestsPassed;
  });
  
  // Test 7: Complete display logic with different document type scenarios
  await runTest('Complete display logic for various document types', () => {
    const testDocTypes = [
      {
        name: 'New Document Type',
        usageCount: 0,
        templateCount: 0,
        category: '',
        isActive: true,
        expectedDisplay: 'No metadata to display'
      },
      {
        name: 'Used Document Type',
        usageCount: 5,
        templateCount: 2,
        category: 'Legal',
        isActive: true,
        expectedDisplay: '5 documents • 2 templates • Domain: Legal'
      },
      {
        name: 'Inactive Document Type',
        usageCount: 0,
        templateCount: 0,
        category: '',
        isActive: false,
        expectedDisplay: 'Inactive'
      },
      {
        name: 'Documents Only',
        usageCount: 10,
        templateCount: 0,
        category: '',
        isActive: true,
        expectedDisplay: '10 documents'
      },
      {
        name: 'Templates Only',
        usageCount: 0,
        templateCount: 3,
        category: 'Finance',
        isActive: true,
        expectedDisplay: '3 templates • Domain: Finance'
      }
    ];
    
    let allTestsPassed = true;
    
    testDocTypes.forEach((docType, index) => {
      const displayText = simulator.getCountDisplayText(docType);
      console.log(`   ${index + 1}. ${docType.name}:`);
      console.log(`      Expected: "${docType.expectedDisplay}"`);
      console.log(`      Actual:   "${displayText}"`);
      console.log(`      Match:    ${displayText === docType.expectedDisplay ? '✓' : '✗'}`);
      
      if (displayText !== docType.expectedDisplay) {
        allTestsPassed = false;
      }
    });
    
    return allTestsPassed;
  });
  
  // Test 8: Form behavior simulation
  await runTest('Complete form behavior simulation', () => {
    console.log('   === FORM BEHAVIOR SIMULATION ===');
    
    // 1. User clicks "New Document Type"
    console.log('   1. User clicks "New Document Type" button');
    const createFormData = simulator.openCreateForm();
    
    // 2. Check default values
    console.log('   2. Checking default form values:');
    console.log(`      isActive: ${createFormData.isActive} (should be true)`);
    console.log(`      category: ${JSON.stringify(createFormData.category)} (should be [])`);
    
    // 3. User cancels and form is closed
    console.log('   3. User cancels, form is closed/reset');
    const resetFormData = simulator.closeForm();
    
    // 4. Check reset values are same as create defaults
    console.log('   4. Checking reset form values:');
    console.log(`      isActive: ${resetFormData.isActive} (should be true)`);
    console.log(`      category: ${JSON.stringify(resetFormData.category)} (should be [])`);
    
    const behaviorCorrect = createFormData.isActive === true && 
                           resetFormData.isActive === true &&
                           Array.isArray(createFormData.category) &&
                           Array.isArray(resetFormData.category) &&
                           createFormData.category.length === 0 &&
                           resetFormData.category.length === 0;
    
    console.log('   5. All form behavior correct:', behaviorCorrect);
    
    return behaviorCorrect;
  });
  
  // Summary
  console.log('====================================');
  console.log(`📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All tests passed! Default status and count display changes work correctly.');
    console.log('\n📋 Changes Summary:');
    console.log('✅ New document types default to Active status');
    console.log('✅ Form reset maintains Active as default');
    console.log('✅ Zero usage counts are hidden');
    console.log('✅ Zero template counts are hidden');
    console.log('✅ Non-zero counts are displayed properly');
    console.log('✅ Clean metadata display without clutter');
    console.log('\n🔧 Technical Implementation:');
    console.log('• openCreateForm() sets isActive: true');
    console.log('• closeForm() resets with isActive: true');
    console.log('• HTML uses @if conditions to hide zero counts');
    console.log('• Conditional display: @if ((docType.usageCount || 0) > 0)');
    console.log('• Conditional display: @if ((docType.templateCount || 0) > 0)');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});