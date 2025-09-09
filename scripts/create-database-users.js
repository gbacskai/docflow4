#!/usr/bin/env node

// Simple script to create User records in database after Cognito users are created
const { 
  CognitoIdentityProviderClient,
  AdminGetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const { fromIni } = require('@aws-sdk/credential-providers');
const fs = require('fs');
const path = require('path');

// Add timeout
const SCRIPT_TIMEOUT = 90000; // 90 seconds
setTimeout(() => {
  console.log('⏰ Script timeout reached, exiting gracefully...');
  process.exit(0);
}, SCRIPT_TIMEOUT);

try {
  const amplifyOutputsPath = path.join(__dirname, '..', 'amplify_outputs.json');
  
  if (!fs.existsSync(amplifyOutputsPath)) {
    console.log('⚠️  amplify_outputs.json not found');
    process.exit(0);
  }
  
  const amplifyOutputs = JSON.parse(fs.readFileSync(amplifyOutputsPath, 'utf8'));
  
  if (!amplifyOutputs?.auth?.user_pool_id || !amplifyOutputs?.data?.url) {
    console.log('⚠️  Required configuration not found');
    process.exit(0);
  }

  const userPoolId = amplifyOutputs.auth.user_pool_id;
  const region = amplifyOutputs.auth.aws_region;
  const graphqlEndpoint = amplifyOutputs.data.url;
  const apiKey = amplifyOutputs.data.api_key;

  console.log(`Using User Pool: ${userPoolId}`);
  console.log(`Using GraphQL API: ${graphqlEndpoint}`);

  // Skip if in AWS deployment
  const isAmplifyBuild = process.env.AWS_APP_ID && process.env.AWS_BRANCH;
  const hasAmplifyRole = process.env.AWS_EXECUTION_ENV || process.env.CODEBUILD_BUILD_ID;
  const isLocalDevelopment = process.env.AWS_PROFILE && !isAmplifyBuild && !hasAmplifyRole;
  
  if (isAmplifyBuild || hasAmplifyRole || !isLocalDevelopment) {
    console.log('✅ Skipping database user creation (not in local development)');
    process.exit(0);
  }
  
  const cognitoClient = new CognitoIdentityProviderClient({ 
    region: region,
    credentials: fromIni({ profile: 'aws_amplify_docflow4' })
  });

  const testUsers = [
    {
      email: 'test_admin@docflow4.com',
      userType: 'admin',
      firstName: 'Test',
      lastName: 'Admin'
    },
    {
      email: 'test_client@docflow4.com',
      userType: 'client', 
      firstName: 'Test',
      lastName: 'Client'
    }
  ];

  // Get Cognito user ID
  async function getCognitoUserId(email) {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: email
      });
      
      const response = await cognitoClient.send(command);
      return response.Username;
    } catch (error) {
      console.error(`❌ Error getting Cognito user ID for ${email}:`, error.message);
      return null;
    }
  }

  // Create user in database using GraphQL
  async function createDatabaseUser(user, cognitoUserId) {
    const mutation = `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          email
          userType
          firstName
          lastName
          status
          cognitoUserId
        }
      }
    `;

    const variables = {
      input: {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        version: new Date().toISOString(),
        email: user.email,
        userType: user.userType,
        firstName: user.firstName,
        lastName: user.lastName,
        status: 'active',
        emailVerified: true,
        cognitoUserId: cognitoUserId,
        createdAt: new Date().toISOString(),
        interestedDocumentTypes: []
      }
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
        console.error(`❌ GraphQL errors:`, result.errors);
        return false;
      }

      console.log(`✅ Database user created: ${user.email} (${user.userType})`);
      return true;
    } catch (error) {
      console.error(`❌ Error creating database user ${user.email}:`, error.message);
      return false;
    }
  }

  async function main() {
    console.log('🚀 Creating database User records...\n');
    
    let successCount = 0;
    
    for (const user of testUsers) {
      console.log(`🔄 Processing ${user.email}...`);
      
      // Get Cognito user ID
      const cognitoUserId = await getCognitoUserId(user.email);
      if (!cognitoUserId) {
        console.log(`❌ Could not get Cognito ID for ${user.email}`);
        continue;
      }
      console.log(`✅ Cognito ID: ${cognitoUserId}`);
      
      // Create database record
      const success = await createDatabaseUser(user, cognitoUserId);
      if (success) {
        successCount++;
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log(`📊 Summary: ${successCount}/${testUsers.length} users created in database`);
    console.log(`🔑 Test credentials:`);
    console.log(`   Password: TestPass123!`);
    console.log(`   👤 Admin: test_admin@docflow4.com (should have admin privileges)`);
    console.log(`   👤 Client: test_client@docflow4.com (regular user)`);
    console.log(`\n🎯 Ready! Login with admin user to see the Create User button.`);
  }

  main().catch(console.error);

} catch (error) {
  console.log('❌ Failed to initialize:', error.message);
  process.exit(0);
}