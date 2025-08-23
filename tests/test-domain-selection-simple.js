/**
 * Simplified Domain Selection Test Script for Browser Console
 * 
 * Instructions:
 * 1. Navigate to your application in browser (http://localhost:4200)
 * 2. Sign in to your account
 * 3. Go to Document Types page
 * 4. Open browser console (F12 -> Console)
 * 5. Copy and paste this entire script
 * 6. Run: testDomainSelection()
 */

async function testDomainSelection() {
  console.clear();
  console.log('🧪 Starting Domain Selection Test...');
  console.log('================================');
  console.log('');
  
  const startTime = Date.now();
  let testsPassed = 0;
  let totalTests = 0;
  
  function assert(condition, message, step) {
    totalTests++;
    if (condition) {
      console.log(`✅ ${step}: ${message}`);
      testsPassed++;
    } else {
      console.log(`❌ ${step}: ${message}`);
      throw new Error(`Test failed at ${step}: ${message}`);
    }
  }
  
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  try {
    // Step 1: Check if we're on Document Types page
    assert(
      window.location.href.includes('document-types'),
      'On Document Types page',
      'Step 1'
    );
    
    // Step 2: Click "New Document Type" to open form
    console.log('📝 Step 2: Opening new document type form...');
    const addButton = document.querySelector('.add-button');
    assert(addButton, 'Add button found', 'Step 2a');
    
    addButton.click();
    await sleep(1000);
    
    const form = document.querySelector('.document-type-form');
    assert(form, 'Form opened successfully', 'Step 2b');
    
    // Step 3: Open domain selection sidebar
    console.log('🔍 Step 3: Opening domain selection sidebar...');
    const selectDomainsBtn = document.querySelector('.select-domains-btn');
    assert(selectDomainsBtn, 'Select Domains button found', 'Step 3a');
    
    selectDomainsBtn.click();
    await sleep(1000);
    
    const sidebar = document.querySelector('.domain-sidebar');
    assert(sidebar, 'Domain sidebar opened', 'Step 3b');
    
    // Step 4: Get initial selection count
    console.log('📊 Step 4: Getting initial selection count...');
    const selectionSummary = document.querySelector('.sidebar-footer .selection-summary');
    assert(selectionSummary, 'Selection summary element found', 'Step 4a');
    
    const initialCountText = selectionSummary.textContent.trim();
    console.log(`📊 Initial selection text: "${initialCountText}"`);
    
    const initialCountMatch = initialCountText.match(/(\\d+) domain\\(s\\) selected/);
    const initialCount = initialCountMatch ? parseInt(initialCountMatch[1]) : 0;
    console.log(`📈 Initial selection count: ${initialCount}`);
    
    // Step 5: Find and select an unselected domain
    console.log('🎯 Step 5: Finding and selecting unselected domain...');
    const unselectedDomains = document.querySelectorAll('.domain-item:not(.selected)');
    assert(unselectedDomains.length > 0, `Found ${unselectedDomains.length} unselected domains`, 'Step 5a');
    
    const firstUnselectedDomain = unselectedDomains[0];
    const domainNameEl = firstUnselectedDomain.querySelector('h4');
    const domainName = domainNameEl ? domainNameEl.textContent.trim() : 'Unknown';
    console.log(`🎯 Selecting domain: "${domainName}"`);
    
    const domainInfo = firstUnselectedDomain.querySelector('.domain-info');
    assert(domainInfo, 'Domain info clickable area found', 'Step 5b');
    
    // Click to select the domain
    domainInfo.click();
    await sleep(500);
    
    // Step 6: Check if domain became selected visually
    console.log('✨ Step 6: Checking visual selection feedback...');
    const isSelected = firstUnselectedDomain.classList.contains('selected');
    assert(isSelected, 'Domain shows as selected (has .selected class)', 'Step 6');
    
    // Step 7: Check if selection count increased
    console.log('📊 Step 7: Checking selection count update...');
    const newCountText = selectionSummary.textContent.trim();
    console.log(`📊 New selection text: "${newCountText}"`);
    
    const newCountMatch = newCountText.match(/(\\d+) domain\\(s\\) selected/);
    const newCount = newCountMatch ? parseInt(newCountMatch[1]) : 0;
    console.log(`📈 New selection count: ${newCount}`);
    
    assert(
      newCount === initialCount + 1,
      `Selection count increased from ${initialCount} to ${newCount}`,
      'Step 7'
    );
    
    // Step 8: Apply selection
    console.log('🔄 Step 8: Applying selection...');
    const applyBtn = document.querySelector('.btn-apply');
    assert(applyBtn, 'Apply button found', 'Step 8a');
    
    applyBtn.click();
    await sleep(1000);
    
    // Step 9: Check if sidebar closed
    console.log('👀 Step 9: Checking if sidebar closed...');
    const sidebarAfter = document.querySelector('.domain-sidebar');
    assert(!sidebarAfter, 'Sidebar closed after apply', 'Step 9');
    
    // Step 10: Check if main form was updated
    console.log('📋 Step 10: Checking main form update...');
    const selectedDomainsDisplay = document.querySelector('.selected-domains-display');
    if (selectedDomainsDisplay) {
      const displayedDomainItems = selectedDomainsDisplay.querySelectorAll('.selected-domain-item');
      console.log(`✅ Main form shows ${displayedDomainItems.length} selected domain(s)`);
      
      // Check if our selected domain is in the list
      const displayedDomainNames = Array.from(displayedDomainItems).map(item => {
        const nameEl = item.querySelector('.domain-name');
        return nameEl ? nameEl.textContent.trim() : '';
      });
      
      assert(
        displayedDomainNames.includes(domainName),
        `Selected domain "${domainName}" appears in main form`,
        'Step 10a'
      );
      
      console.log('📋 Displayed domains:', displayedDomainNames);
    } else {
      // Check for no-domains message
      const noDomains = document.querySelector('.no-domains-message');
      assert(!noDomains, 'No "no domains" message shown when domains are selected', 'Step 10b');
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('================================');
    console.log(`✅ ${testsPassed}/${totalTests} tests passed`);
    console.log(`⏱️  Test completed in ${duration}ms`);
    console.log('🚀 Domain selection functionality is working correctly!');
    console.log('');
    
    return true;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('');
    console.log('🚨 TEST FAILED');
    console.log('================================');
    console.log(`❌ ${testsPassed}/${totalTests} tests passed`);
    console.log(`💥 Error: ${error.message}`);
    console.log(`⏱️  Test failed after ${duration}ms`);
    console.log('');
    console.log('🔧 Domain selection functionality needs debugging');
    
    return false;
  }
}

// Make the function available globally
window.testDomainSelection = testDomainSelection;

console.log('🧪 Domain Selection Test Script Loaded');
console.log('📋 To run the test:');
console.log('   1. Make sure you are signed in');
console.log('   2. Navigate to Document Types page');
console.log('   3. Run: testDomainSelection()');
console.log('');