#!/usr/bin/env node

const { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand, 
  AdminSetUserPasswordCommand,
  AdminConfirmSignUpCommand,
  UsernameExistsException,
  AdminGetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const { fromIni } = require('@aws-sdk/credential-providers');

// Read amplify_outputs.json to get configuration
const fs = require('fs');
const path = require('path');

// Add timeout and error handling
const SCRIPT_TIMEOUT = 90000; // 90 seconds
const startTime = Date.now();

// Set script timeout
setTimeout(() => {
  console.log('⏰ Script timeout reached, exiting gracefully...');
  process.exit(0);
}, SCRIPT_TIMEOUT);

try {
  const amplifyOutputsPath = path.join(__dirname, '..', 'amplify_outputs.json');
  
  if (!fs.existsSync(amplifyOutputsPath)) {
    console.log('⚠️  amplify_outputs.json not found, skipping test user creation');
    process.exit(0);
  }
  
  const amplifyOutputs = JSON.parse(fs.readFileSync(amplifyOutputsPath, 'utf8'));
  
  if (!amplifyOutputs?.auth?.user_pool_id || !amplifyOutputs?.data?.url) {
    console.log('⚠️  Required configuration not found, skipping test user creation');
    process.exit(0);
  }

const userPoolId = amplifyOutputs.auth.user_pool_id;
const region = amplifyOutputs.auth.aws_region;
const graphqlEndpoint = amplifyOutputs.data.url;
const apiKey = amplifyOutputs.data.api_key;

console.log(`Using User Pool: ${userPoolId} in region: ${region}`);
console.log(`Using GraphQL API: ${graphqlEndpoint}`);

  // Determine if we're in AWS Amplify deployment environment
  const isAmplifyBuild = process.env.AWS_APP_ID && process.env.AWS_BRANCH;
  const hasAmplifyRole = process.env.AWS_EXECUTION_ENV || process.env.CODEBUILD_BUILD_ID;
  const isLocalDevelopment = process.env.AWS_PROFILE && !isAmplifyBuild && !hasAmplifyRole;
  
  if (isAmplifyBuild || hasAmplifyRole || !isLocalDevelopment) {
    console.log('🏗️  Running in AWS Amplify deployment environment');
    console.log('⚠️  Test user creation requires additional IAM permissions in production');
    console.log('✅ Skipping test user creation (normal for deployment)');
    console.log('📝 Users can register through the application or via AWS Console');
    process.exit(0);
  }
  
  const cognitoClient = new CognitoIdentityProviderClient({ 
    region: region,
    credentials: fromIni({ profile: 'aws_amplify_permithunter' })
  });

const testUsers = [
  {
    email: 'test_admin@docflow4.com',
    role: 'admin',
    userType: 'admin',
    firstName: 'Test',
    lastName: 'Admin'
  },
  {
    email: 'test_client@docflow4.com', 
    role: 'client',
    userType: 'client',
    firstName: 'Test',
    lastName: 'Client'
  }
];

const DEFAULT_PASSWORD = 'TestPass123!';

// GraphQL mutation to create user record
async function createUserRecord(user, cognitoUserId) {
  const mutation = `
    mutation CreateUser(
      $id: String!
      $version: AWSDateTime!
      $email: String!
      $userType: UserUserTypeEnum
      $firstName: String
      $lastName: String
      $status: UserStatusEnum
      $emailVerified: Boolean
      $cognitoUserId: String
      $createdAt: AWSDateTime
    ) {
      createUser(input: {
        id: $id
        version: $version
        email: $email
        userType: $userType
        firstName: $firstName
        lastName: $lastName
        status: $status
        emailVerified: $emailVerified
        cognitoUserId: $cognitoUserId
        createdAt: $createdAt
      }) {
        id
        email
        userType
        firstName
        lastName
        status
      }
    }
  `;

  const variables = {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    version: new Date().toISOString(),
    email: user.email,
    userType: user.userType.toUpperCase(),
    firstName: user.firstName,
    lastName: user.lastName,
    status: 'ACTIVE',
    emailVerified: true,
    cognitoUserId: cognitoUserId,
    createdAt: new Date().toISOString()
  };

  try {
    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        query: mutation,
        variables: variables
      })
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error(`❌ GraphQL errors creating user record:`, result.errors);
      return { success: false, error: result.errors };
    }

    console.log(`✅ User record created in database for ${user.email}`);
    return { success: true, data: result.data.createUser };
  } catch (error) {
    console.error(`❌ Error creating user record for ${user.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function getCognitoUserId(email) {
  try {
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: email
    });
    
    const response = await cognitoClient.send(getUserCommand);
    return response.Username; // This is the Cognito User ID (sub)
  } catch (error) {
    console.error(`❌ Error getting Cognito user ID for ${email}:`, error.message);
    return null;
  }
}

async function createUser(user) {
  try {
    console.log(`\n🔄 Processing user: ${user.email}`);
    let cognitoUserCreated = false;
    
    // Step 1: Create Cognito user
    try {
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
      cognitoUserCreated = true;
      console.log(`✅ Cognito user created: ${user.email}`);
      
      // Set permanent password
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        Password: DEFAULT_PASSWORD,
        Permanent: true
      });
      
      await cognitoClient.send(setPasswordCommand);
      console.log(`✅ Password set for: ${user.email}`);

      // Try to confirm the user signup (may already be confirmed)
      try {
        const confirmCommand = new AdminConfirmSignUpCommand({
          UserPoolId: userPoolId,
          Username: user.email
        });
        
        await cognitoClient.send(confirmCommand);
        console.log(`✅ User confirmed: ${user.email}`);
      } catch (confirmError) {
        // Ignore confirmation errors - user might already be confirmed
        if (!confirmError.message?.includes('Current status is CONFIRMED')) {
          console.warn(`⚠️  Warning confirming user ${user.email}:`, confirmError.message);
        } else {
          console.log(`✅ User already confirmed: ${user.email}`);
        }
      }
    } catch (error) {
      if (error instanceof UsernameExistsException) {
        console.log(`✅ Cognito user already exists: ${user.email}`);
      } else {
        console.error(`❌ Error creating Cognito user ${user.email}:`, error.message);
        return { success: false, error: error.message };
      }
    }

    // Step 2: Get Cognito User ID
    const cognitoUserId = await getCognitoUserId(user.email);
    if (!cognitoUserId) {
      console.error(`❌ Could not get Cognito User ID for ${user.email}`);
      return { success: false, error: 'Could not get Cognito User ID' };
    }
    console.log(`✅ Cognito User ID obtained: ${cognitoUserId}`);

    // Step 3: Create database record
    const dbResult = await createUserRecord(user, cognitoUserId);
    if (!dbResult.success) {
      console.error(`❌ Failed to create database record for ${user.email}`);
      return { success: false, error: dbResult.error };
    }

    console.log(`🎉 Complete user setup successful for ${user.email} (${user.userType})`);
    return { success: true, existed: !cognitoUserCreated };
    
  } catch (error) {
    console.error(`❌ Error in createUser for ${user.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Creating complete test users (Cognito + Database)...\n');
  
  try {
    const results = [];
    
    // Process users sequentially to avoid conflicts
    for (const user of testUsers) {
      const result = await createUser(user);
      results.push(result);
      
      // Add small delay between users
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const createdCount = results.filter(r => r.success && !r.existed).length;
    const existedCount = results.filter(r => r.existed).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`\n📊 Final Summary:`);
    console.log(`   ✅ Created: ${createdCount}`);
    console.log(`   ⚡ Already existed: ${existedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`\n🔑 Test credentials:`);
    console.log(`   🔐 Password: ${DEFAULT_PASSWORD}`);
    console.log(`   👤 Admin: test_admin@docflow4.com (userType: admin)`);
    console.log(`   👤 Client: test_client@docflow4.com (userType: client)`);
    console.log(`\n🎯 Ready to test! Login with admin user to see admin features.`);
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

main();

} catch (error) {
  console.log('❌ Failed to initialize script:', error.message);
  console.log('⚠️  Exiting gracefully...');
  process.exit(0);
}