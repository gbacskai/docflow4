/**
 * Test script for Domain Selection Sidebar functionality
 * This script tests the document type domain selection feature
 */

async function testDomainSelection() {
  console.log('🧪 Starting Domain Selection Test...');
  
  try {
    // Step 1: Navigate to Document Types page if not already there
    if (!window.location.href.includes('document-types')) {
      console.log('❌ Please navigate to the Document Types page first');
      return false;
    }

    // Step 2: Click "New Document Type" to open the form
    console.log('📝 Step 1: Opening new document type form...');
    const addButton = document.querySelector('.add-button');
    if (!addButton) {
      console.log('❌ Add button not found');
      return false;
    }
    addButton.click();

    // Wait for form to appear
    await sleep(1000);

    // Step 3: Find and click the "Select Domains" button
    console.log('🔍 Step 2: Looking for Select Domains button...');
    const selectDomainsBtn = document.querySelector('.select-domains-btn');
    if (!selectDomainsBtn) {
      console.log('❌ Select Domains button not found');
      return false;
    }

    console.log('✅ Select Domains button found');
    selectDomainsBtn.click();

    // Wait for sidebar to appear
    await sleep(1000);

    // Step 4: Check if sidebar opened
    console.log('👀 Step 3: Checking if sidebar opened...');
    const sidebar = document.querySelector('.domain-sidebar');
    if (!sidebar) {
      console.log('❌ Domain sidebar did not open');
      return false;
    }
    console.log('✅ Domain sidebar opened successfully');

    // Step 5: Get initial selection count
    console.log('📊 Step 4: Getting initial selection count...');
    const initialCountElement = document.querySelector('.sidebar-footer .selection-summary');
    if (!initialCountElement) {
      console.log('❌ Selection summary not found');
      return false;
    }
    
    const initialCountText = initialCountElement.textContent.trim();
    const initialCount = parseInt(initialCountText.match(/(\d+) domain\(s\) selected/)?.[1] || '0');
    console.log(`📈 Initial selection count: ${initialCount}`);

    // Step 6: Find the first unselected domain
    console.log('🎯 Step 5: Finding first unselected domain...');
    const domainItems = document.querySelectorAll('.domain-item:not(.selected)');
    if (domainItems.length === 0) {
      console.log('❌ No unselected domains found');
      return false;
    }

    const firstUnselectedDomain = domainItems[0];
    const domainName = firstUnselectedDomain.querySelector('h4')?.textContent?.trim();
    console.log(`🎯 Found unselected domain: ${domainName}`);

    // Step 7: Click the domain to select it
    console.log('👆 Step 6: Clicking to select domain...');
    const domainInfo = firstUnselectedDomain.querySelector('.domain-info');
    if (!domainInfo) {
      console.log('❌ Domain info section not found');
      return false;
    }
    domainInfo.click();

    // Wait for UI to update
    await sleep(500);

    // Step 8: Check if domain became selected (visual feedback)
    console.log('✨ Step 7: Checking visual selection feedback...');
    if (firstUnselectedDomain.classList.contains('selected')) {
      console.log('✅ Domain shows as selected (has .selected class)');
    } else {
      console.log('❌ Domain does not show as selected (missing .selected class)');
    }

    // Step 9: Check if selection count increased
    console.log('📊 Step 8: Checking if selection count increased...');
    const newCountText = initialCountElement.textContent.trim();
    const newCount = parseInt(newCountText.match(/(\d+) domain\(s\) selected/)?.[1] || '0');
    console.log(`📈 New selection count: ${newCount}`);

    if (newCount === initialCount + 1) {
      console.log('✅ Selection count increased by 1 as expected');
    } else {
      console.log(`❌ Expected count: ${initialCount + 1}, Actual count: ${newCount}`);
      return false;
    }

    // Step 10: Test the Apply button functionality
    console.log('🔄 Step 9: Testing Apply button...');
    const applyBtn = document.querySelector('.btn-apply');
    if (!applyBtn) {
      console.log('❌ Apply button not found');
      return false;
    }

    applyBtn.click();

    // Wait for sidebar to close and form to update
    await sleep(1000);

    // Step 11: Check if sidebar closed
    console.log('👀 Step 10: Checking if sidebar closed...');
    const sidebarAfterApply = document.querySelector('.domain-sidebar');
    if (!sidebarAfterApply) {
      console.log('✅ Sidebar closed successfully');
    } else {
      console.log('❌ Sidebar did not close');
      return false;
    }

    // Step 12: Check if main form shows the selected domain
    console.log('📋 Step 11: Checking main form display...');
    const selectedDomainsDisplay = document.querySelector('.selected-domains-display');
    if (selectedDomainsDisplay) {
      const displayedDomains = selectedDomainsDisplay.querySelectorAll('.selected-domain-item');
      console.log(`✅ Main form shows ${displayedDomains.length} selected domain(s)`);
      
      // Check if our selected domain is displayed
      const domainNames = Array.from(displayedDomains).map(item => 
        item.querySelector('.domain-name')?.textContent?.trim()
      );
      
      if (domainNames.includes(domainName)) {
        console.log(`✅ Selected domain "${domainName}" is displayed in main form`);
      } else {
        console.log(`❌ Selected domain "${domainName}" is NOT displayed in main form`);
        console.log('Displayed domains:', domainNames);
        return false;
      }
    } else {
      // Check if there's a "no domains" message when there should be domains
      const noDomains = document.querySelector('.no-domains-message');
      if (noDomains) {
        console.log('❌ Main form still shows "No domains selected" after applying selection');
        return false;
      }
    }

    // All tests passed!
    console.log('🎉 All tests passed! Domain selection functionality is working correctly.');
    return true;

  } catch (error) {
    console.error('💥 Test failed with error:', error);
    return false;
  }
}

// Helper function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to run the test with better formatting
async function runDomainSelectionTest() {
  console.clear();
  console.log('🚀 Domain Selection Test Suite');
  console.log('================================');
  console.log('');
  
  const startTime = Date.now();
  const result = await testDomainSelection();
  const endTime = Date.now();
  
  console.log('');
  console.log('================================');
  if (result) {
    console.log('🎊 TEST SUITE PASSED');
    console.log('✅ Domain selection sidebar is working correctly!');
  } else {
    console.log('🚨 TEST SUITE FAILED');
    console.log('❌ Domain selection sidebar has issues that need to be fixed.');
  }
  console.log(`⏱️  Test completed in ${endTime - startTime}ms`);
  console.log('================================');
  
  return result;
}

// Export the test function
window.testDomainSelection = runDomainSelectionTest;

// Auto-run if script is loaded directly
console.log('🧪 Domain Selection Test Script Loaded');
console.log('📋 Run test with: testDomainSelection()');
console.log('');

// Optionally auto-run the test (uncomment the line below)
// runDomainSelectionTest();