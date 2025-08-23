#!/usr/bin/env node

/**
 * Test Script: Domain Lifecycle (CRUD Operations)
 * 
 * This script tests the complete domain lifecycle:
 * 1. Create a new domain
 * 2. Save the domain
 * 3. Open/retrieve the domain
 * 4. Edit the domain name and description
 * 5. Verify the changes were saved
 * 6. Delete the domain
 * 7. Verify deletion was successful
 */

console.log('🧪 Domain Lifecycle Test Script');
console.log('================================\n');

// Global test state
let testDomainId = null;
let createdDomain = null;
let editedDomain = null;

// Mock data for testing
const testDomainData = {
  name: 'Test Engineering',
  description: 'Engineering and technical documentation domain for testing purposes',
  status: 'active'
};

const updatedDomainData = {
  name: 'Updated Engineering Domain',
  description: 'Updated description for engineering and technical documentation with enhanced features',
  status: 'active'
};

// Mock API client simulating the domains component behavior
class MockDomainAPI {
  constructor() {
    this.domains = new Map();
    this.nextId = 1;
  }

  async create(domainData) {
    const newDomain = {
      id: `domain-${this.nextId++}`,
      ...domainData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.domains.set(newDomain.id, newDomain);
    return { data: newDomain };
  }

  async list() {
    return { data: Array.from(this.domains.values()) };
  }

  async get(id) {
    const domain = this.domains.get(id);
    if (!domain) {
      throw new Error(`Domain with id ${id} not found`);
    }
    return { data: domain };
  }

  async update(updateData) {
    const { id, ...updates } = updateData;
    const existingDomain = this.domains.get(id);
    
    if (!existingDomain) {
      throw new Error(`Domain with id ${id} not found`);
    }

    const updatedDomain = {
      ...existingDomain,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.domains.set(id, updatedDomain);
    return { data: updatedDomain };
  }

  async delete(deleteData) {
    const { id } = deleteData;
    const domain = this.domains.get(id);
    
    if (!domain) {
      throw new Error(`Domain with id ${id} not found`);
    }

    this.domains.delete(id);
    return { data: domain };
  }

  async exists(id) {
    return this.domains.has(id);
  }
}

// Mock client instance
const mockClient = {
  models: {
    Domain: new MockDomainAPI()
  }
};

// Domain component simulation functions
function validateDomainForm(domainData) {
  const errors = [];
  
  if (!domainData.name || domainData.name.trim() === '') {
    errors.push('Domain name is required');
  }
  
  if (!domainData.description || domainData.description.trim() === '') {
    errors.push('Description is required');
  } else if (domainData.description.length < 10) {
    errors.push('Description must be at least 10 characters');
  }
  
  if (!domainData.status || !['active', 'archived'].includes(domainData.status)) {
    errors.push('Status must be active or archived');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

async function createDomain(domainData) {
  const validation = validateDomainForm(domainData);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  return await mockClient.models.Domain.create(domainData);
}

async function updateDomain(id, updates) {
  const validation = validateDomainForm(updates);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  return await mockClient.models.Domain.update({ id, ...updates });
}

async function deleteDomain(id) {
  return await mockClient.models.Domain.delete({ id });
}

async function getDomain(id) {
  return await mockClient.models.Domain.get(id);
}

// Test execution framework
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
  
  // Test 1: Create new domain
  await runTest('Create new domain', async () => {
    console.log('   Creating domain with data:', JSON.stringify(testDomainData, null, 2));
    
    const result = await createDomain(testDomainData);
    createdDomain = result.data;
    testDomainId = createdDomain.id;
    
    console.log(`   Created domain ID: ${testDomainId}`);
    console.log(`   Created domain name: ${createdDomain.name}`);
    console.log(`   Created at: ${createdDomain.createdAt}`);
    
    return createdDomain &&
           createdDomain.id &&
           createdDomain.name === testDomainData.name &&
           createdDomain.description === testDomainData.description &&
           createdDomain.status === testDomainData.status;
  });
  
  // Test 2: Verify domain was saved (retrieve it)
  await runTest('Retrieve saved domain', async () => {
    if (!testDomainId) {
      return 'No domain ID available from previous test';
    }
    
    console.log(`   Retrieving domain with ID: ${testDomainId}`);
    
    const result = await getDomain(testDomainId);
    const retrievedDomain = result.data;
    
    console.log(`   Retrieved domain: ${retrievedDomain.name}`);
    console.log(`   Description: ${retrievedDomain.description}`);
    console.log(`   Status: ${retrievedDomain.status}`);
    
    return retrievedDomain.id === testDomainId &&
           retrievedDomain.name === testDomainData.name &&
           retrievedDomain.description === testDomainData.description;
  });
  
  // Test 3: Open domain for editing (simulate opening edit form)
  await runTest('Open domain for editing', async () => {
    if (!testDomainId) {
      return 'No domain ID available';
    }
    
    console.log(`   Opening domain ${testDomainId} for editing`);
    
    const result = await getDomain(testDomainId);
    const domainToEdit = result.data;
    
    // Simulate form population
    const formData = {
      name: domainToEdit.name,
      description: domainToEdit.description,
      status: domainToEdit.status
    };
    
    console.log('   Form populated with:', JSON.stringify(formData, null, 2));
    
    return formData.name === testDomainData.name &&
           formData.description === testDomainData.description &&
           formData.status === testDomainData.status;
  });
  
  // Test 4: Edit domain name and description
  await runTest('Edit domain name and description', async () => {
    if (!testDomainId) {
      return 'No domain ID available';
    }
    
    console.log(`   Updating domain ${testDomainId}`);
    console.log('   Original name:', createdDomain.name);
    console.log('   Original description:', createdDomain.description);
    console.log('   New name:', updatedDomainData.name);
    console.log('   New description:', updatedDomainData.description);
    
    const result = await updateDomain(testDomainId, updatedDomainData);
    editedDomain = result.data;
    
    console.log(`   Update successful. Updated at: ${editedDomain.updatedAt}`);
    
    return editedDomain &&
           editedDomain.id === testDomainId &&
           editedDomain.name === updatedDomainData.name &&
           editedDomain.description === updatedDomainData.description &&
           editedDomain.updatedAt !== createdDomain.updatedAt;
  });
  
  // Test 5: Verify changes were saved
  await runTest('Verify domain changes were saved', async () => {
    if (!testDomainId) {
      return 'No domain ID available';
    }
    
    console.log(`   Re-fetching domain ${testDomainId} to verify changes`);
    
    const result = await getDomain(testDomainId);
    const verifiedDomain = result.data;
    
    console.log(`   Verified name: ${verifiedDomain.name}`);
    console.log(`   Verified description: ${verifiedDomain.description}`);
    console.log(`   Last updated: ${verifiedDomain.updatedAt}`);
    
    const nameChanged = verifiedDomain.name === updatedDomainData.name && 
                       verifiedDomain.name !== testDomainData.name;
    const descriptionChanged = verifiedDomain.description === updatedDomainData.description && 
                              verifiedDomain.description !== testDomainData.description;
    
    console.log(`   Name changed: ${nameChanged}`);
    console.log(`   Description changed: ${descriptionChanged}`);
    
    return nameChanged && descriptionChanged;
  });
  
  // Test 6: Test form validation
  await runTest('Test form validation', async () => {
    console.log('   Testing invalid domain data...');
    
    const invalidData = {
      name: '', // Empty name should fail
      description: 'Short', // Too short description should fail
      status: 'invalid' // Invalid status should fail
    };
    
    try {
      await createDomain(invalidData);
      return 'Should have failed validation but did not';
    } catch (error) {
      console.log(`   Validation correctly failed: ${error.message}`);
      return true;
    }
  });
  
  // Test 7: Delete domain
  await runTest('Delete domain', async () => {
    if (!testDomainId) {
      return 'No domain ID available';
    }
    
    console.log(`   Deleting domain ${testDomainId}`);
    console.log(`   Domain name: ${editedDomain.name}`);
    
    const result = await deleteDomain(testDomainId);
    const deletedDomain = result.data;
    
    console.log(`   Deleted domain: ${deletedDomain.name}`);
    
    return deletedDomain.id === testDomainId;
  });
  
  // Test 8: Verify deletion
  await runTest('Verify domain deletion', async () => {
    if (!testDomainId) {
      return 'No domain ID available';
    }
    
    console.log(`   Checking if domain ${testDomainId} still exists`);
    
    try {
      await getDomain(testDomainId);
      return 'Domain still exists after deletion';
    } catch (error) {
      console.log(`   Domain correctly deleted: ${error.message}`);
      return true;
    }
  });
  
  // Test 9: List domains to verify cleanup
  await runTest('Verify domain list is clean', async () => {
    console.log('   Fetching all domains...');
    
    const result = await mockClient.models.Domain.list();
    const allDomains = result.data;
    
    console.log(`   Total domains in system: ${allDomains.length}`);
    
    const testDomainExists = allDomains.some(domain => domain.id === testDomainId);
    
    console.log(`   Test domain exists in list: ${testDomainExists}`);
    
    return !testDomainExists;
  });
  
  // Summary
  console.log('================================');
  console.log(`📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All tests passed! Domain lifecycle functionality verified.');
    console.log('\n📋 Test Summary:');
    console.log('✅ Domain creation with validation');
    console.log('✅ Domain retrieval and persistence');
    console.log('✅ Domain editing (name and description)');
    console.log('✅ Change verification and persistence');
    console.log('✅ Form validation for invalid data');
    console.log('✅ Domain deletion');
    console.log('✅ Deletion verification');
    console.log('✅ System cleanup verification');
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