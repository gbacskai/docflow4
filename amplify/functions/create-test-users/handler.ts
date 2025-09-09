import type { APIGatewayProxyHandler } from 'aws-lambda';
import { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand, 
  AdminSetUserPasswordCommand,
  AdminConfirmSignUpCommand,
  UserNotFoundException,
  UsernameExistsException 
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});

// Get the User Pool ID from environment
const getUserPoolId = (): string => {
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;
  if (!userPoolId) {
    throw new Error('AMPLIFY_AUTH_USERPOOL_ID environment variable not found');
  }
  return userPoolId;
};

interface TestUser {
  email: string;
  role: 'admin' | 'client';
  firstName: string;
  lastName: string;
}

const testUsers: TestUser[] = [
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

async function createUser(user: TestUser): Promise<{ success: boolean; message: string; existed: boolean }> {
  const userPoolId = getUserPoolId();
  
  try {
    // Try to create the user
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      UserAttributes: [
        { Name: 'email', Value: user.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: user.firstName },
        { Name: 'family_name', Value: user.lastName },
        { Name: 'custom:role', Value: user.role }
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email
      TemporaryPassword: DEFAULT_PASSWORD
    });

    await cognitoClient.send(createUserCommand);
    
    // Set permanent password and confirm user
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      Password: DEFAULT_PASSWORD,
      Permanent: true
    });
    
    await cognitoClient.send(setPasswordCommand);

    // Confirm the user signup
    const confirmCommand = new AdminConfirmSignUpCommand({
      UserPoolId: userPoolId,
      Username: user.email
    });
    
    await cognitoClient.send(confirmCommand);
    
    return {
      success: true,
      message: `User ${user.email} created successfully with role ${user.role}`,
      existed: false
    };
    
  } catch (error: any) {
    if (error instanceof UsernameExistsException) {
      return {
        success: true,
        message: `User ${user.email} already exists, skipping creation`,
        existed: true
      };
    }
    
    console.error(`Error creating user ${user.email}:`, error);
    return {
      success: false,
      message: `Failed to create user ${user.email}: ${error.message}`,
      existed: false
    };
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Creating test users...');
  
  try {
    const results = await Promise.all(
      testUsers.map(user => createUser(user))
    );
    
    const createdCount = results.filter(r => r.success && !r.existed).length;
    const existedCount = results.filter(r => r.existed).length;
    const failedCount = results.filter(r => !r.success).length;
    
    const response = {
      success: failedCount === 0,
      message: `Test users processed: ${createdCount} created, ${existedCount} already existed, ${failedCount} failed`,
      results: results.map((result, index) => ({
        email: testUsers[index].email,
        role: testUsers[index].role,
        ...result
      })),
      credentials: {
        password: DEFAULT_PASSWORD,
        note: 'Both users use the same password for testing'
      }
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify(response, null, 2)
    };
    
  } catch (error: any) {
    console.error('Error in create test users handler:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      })
    };
  }
};