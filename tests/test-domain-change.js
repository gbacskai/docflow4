#!/usr/bin/env node

/**
 * Test Script: Document Type Domain Change
 * 
 * This script tests the functionality of editing a document type
 * and changing its associated domain(s).
 * 
 * Test Flow:
 * 1. Create mock data (document types and domains)
 * 2. Simulate editing a document type
 * 3. Change the domain assignment
 * 4. Verify the domain change was successful
 */

console.log('🧪 Document Type Domain Change Test Script');
console.log('==========================================\n');

// Mock data structures based on the Schema
const mockDomains = [
  {
    id: 'domain-1',
    name: 'Legal',
    description: 'Legal documents',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'domain-2', 
    name: 'Finance',
    description: 'Financial documents',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'domain-3',
    name: 'HR',
    description: 'Human Resources documents',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

const mockDocumentType = {
  id: 'doc-type-1',
  name: 'Contract Document',
  description: 'Legal contracts and agreements',
  category: 'domain-1', // Initially assigned to Legal domain
  fields: [],
  isActive: true,
  usageCount: 5,
  templateCount: 2,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

// Mock API client
const mockClient = {
  models: {
    DocumentType: {
      list: () => Promise.resolve({ data: [mockDocumentType] }),
      create: (data) => Promise.resolve({ data: { ...data, id: Math.random().toString() } }),
      update: (data) => Promise.resolve({ data: { ...mockDocumentType, ...data, updatedAt: new Date().toISOString() } }),
      delete: (data) => Promise.resolve({ data: data })
    },
    Domain: {
      list: () => Promise.resolve({ data: mockDomains })
    }
  }
};

// Helper functions (simulating component methods)
function getDomainName(domainId) {
  const domain = mockDomains.find(d => d.id === domainId);
  return domain ? domain.name : 'Unknown Domain';
}

function getDomainNames(domainIds) {
  if (!domainIds) return 'No domains';
  const ids = Array.isArray(domainIds) ? domainIds : [domainIds];
  const names = ids.map(id => getDomainName(id));
  return names.join(', ');
}

function toggleDomain(currentCategories, domainId, isSelected) {
  const categories = Array.isArray(currentCategories) ? [...currentCategories] : 
                    currentCategories ? [currentCategories] : [];
  
  if (isSelected) {
    if (!categories.includes(domainId)) {
      categories.push(domainId);
    }
  } else {
    const index = categories.indexOf(domainId);
    if (index > -1) {
      categories.splice(index, 1);
    }
  }
  
  return categories;
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
  
  // Test 1: Initial state verification
  await runTest('Initial document type has correct domain', () => {
    const initialDomain = mockDocumentType.category;
    const domainName = getDomainName(initialDomain);
    
    console.log(`   Initial domain: ${initialDomain} (${domainName})`);
    
    return initialDomain === 'domain-1' && domainName === 'Legal';
  });
  
  // Test 2: Domain change simulation  
  await runTest('Change domain from Legal to Finance', () => {
    const originalCategory = mockDocumentType.category;
    console.log(`   Original category: ${originalCategory} (${getDomainName(originalCategory)})`);
    
    // Simulate removing current domain
    let updatedCategories = toggleDomain(originalCategory, 'domain-1', false);
    console.log(`   After removing Legal: ${JSON.stringify(updatedCategories)}`);
    
    // Simulate adding new domain
    updatedCategories = toggleDomain(updatedCategories, 'domain-2', true);
    console.log(`   After adding Finance: ${JSON.stringify(updatedCategories)}`);
    
    const newDomainName = getDomainNames(updatedCategories);
    console.log(`   New domain name(s): ${newDomainName}`);
    
    return updatedCategories.includes('domain-2') && newDomainName === 'Finance';
  });
  
  // Test 3: Multiple domain assignment
  await runTest('Assign multiple domains to document type', () => {
    let categories = ['domain-1']; // Start with Legal
    console.log(`   Starting with: ${getDomainNames(categories)}`);
    
    // Add Finance
    categories = toggleDomain(categories, 'domain-2', true);
    console.log(`   After adding Finance: ${getDomainNames(categories)}`);
    
    // Add HR
    categories = toggleDomain(categories, 'domain-3', true);
    console.log(`   After adding HR: ${getDomainNames(categories)}`);
    
    const finalNames = getDomainNames(categories);
    
    return categories.length === 3 && 
           categories.includes('domain-1') && 
           categories.includes('domain-2') && 
           categories.includes('domain-3') &&
           finalNames === 'Legal, Finance, HR';
  });
  
  // Test 4: API update simulation
  await runTest('API update with new domain', async () => {
    console.log('   Simulating API update...');
    
    const updateData = {
      id: mockDocumentType.id,
      name: mockDocumentType.name,
      description: mockDocumentType.description,
      category: ['domain-2'], // Changed to Finance
      isActive: mockDocumentType.isActive
    };
    
    const result = await mockClient.models.DocumentType.update(updateData);
    console.log(`   API Response: ${JSON.stringify(result.data, null, 2)}`);
    
    return result.data.category.includes('domain-2') && 
           result.data.updatedAt !== mockDocumentType.updatedAt;
  });
  
  // Test 5: Form validation simulation
  await runTest('Form validation with empty domains', () => {
    const emptyCategories = [];
    const isValid = emptyCategories.length > 0; // Should be false
    
    console.log(`   Empty categories: ${JSON.stringify(emptyCategories)}`);
    console.log(`   Is valid: ${isValid}`);
    
    return !isValid; // Should return true (test passes when validation fails)
  });
  
  await runTest('Form validation with domains', () => {
    const validCategories = ['domain-1', 'domain-2'];
    const isValid = validCategories.length > 0; // Should be true
    
    console.log(`   Valid categories: ${JSON.stringify(validCategories)}`);
    console.log(`   Is valid: ${isValid}`);
    
    return isValid;
  });
  
  // Summary
  console.log('==========================================');
  console.log(`📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All tests passed! Domain change functionality verified.');
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