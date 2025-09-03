#!/usr/bin/env node

const { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand, 
  AdminSetUserPasswordCommand,
  AdminConfirmSignUpCommand,
  UsernameExistsException 
} = require('@aws-sdk/client-cognito-identity-provider');

// Read amplify_outputs.json to get User Pool ID
const fs = require('fs');
const path = require('path');

const amplifyOutputsPath = path.join(__dirname, '..', 'amplify_outputs.json');
const amplifyOutputs = JSON.parse(fs.readFileSync(amplifyOutputsPath, 'utf8'));

const userPoolId = amplifyOutputs.auth.user_pool_id;
const region = amplifyOutputs.auth.aws_region;

console.log(`Using User Pool: ${userPoolId} in region: ${region}`);

const cognitoClient = new CognitoIdentityProviderClient({ 
  region: region,
  profile: 'aws_amplify_permithunter'
});

const testUsers = [
  {
    email: 'test_admin@docflow4.com',
    role: 'admin',
    firstName: 'Test',
    lastName: 'Admin'
  },
  {
    email: 'test_client@docflow4.com', 
    role: 'client',
    firstName: 'Test',
    lastName: 'Client'
  }
];

const DEFAULT_PASSWORD = 'TestPass123!';

async function createUser(user) {
  try {
    console.log(`Creating user: ${user.email}`);
    
    // Try to create the user
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      UserAttributes: [
        { Name: 'email', Value: user.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: user.firstName },
        { Name: 'family_name', Value: user.lastName }
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email
      TemporaryPassword: DEFAULT_PASSWORD
    });

    await cognitoClient.send(createUserCommand);
    
    // Set permanent password
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      Password: DEFAULT_PASSWORD,
      Permanent: true
    });
    
    await cognitoClient.send(setPasswordCommand);

    // Try to confirm the user signup (may already be confirmed)
    try {
      const confirmCommand = new AdminConfirmSignUpCommand({
        UserPoolId: userPoolId,
        Username: user.email
      });
      
      await cognitoClient.send(confirmCommand);
    } catch (confirmError) {
      // Ignore confirmation errors - user might already be confirmed
      if (!confirmError.message?.includes('Current status is CONFIRMED')) {
        console.warn(`Warning confirming user ${user.email}:`, confirmError.message);
      }
    }
    
    console.log(`✅ User ${user.email} created successfully with role ${user.role}`);
    return { success: true, existed: false };
    
  } catch (error) {
    if (error instanceof UsernameExistsException) {
      console.log(`✅ User ${user.email} already exists, skipping`);
      return { success: true, existed: true };
    }
    
    console.error(`❌ Error creating user ${user.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('Creating test users...\n');
  
  try {
    const results = await Promise.all(
      testUsers.map(user => createUser(user))
    );
    
    const createdCount = results.filter(r => r.success && !r.existed).length;
    const existedCount = results.filter(r => r.existed).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${createdCount}`);
    console.log(`   Already existed: ${existedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`\n🔑 Test credentials:`);
    console.log(`   Password: ${DEFAULT_PASSWORD}`);
    console.log(`   Admin: test_admin@docflow4.com`);
    console.log(`   Client: test_client@docflow4.com`);
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  }
}

main();