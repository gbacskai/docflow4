import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

// GraphQL Lambda resolver handler
export const handler = async (event: any) => {
  console.log('🔍 Email duplication check handler invoked');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Extract email from GraphQL arguments
    const { email } = event.arguments;
    
    if (!email) {
      throw new Error('Email address is required');
    }

    // Get Users table name from environment variable
    // Amplify automatically provides table names via environment variables
    const usersTableName = process.env['AMPLIFY_DATA_USER_TABLE_NAME'];
    
    if (!usersTableName) {
      console.error('❌ AMPLIFY_DATA_USER_TABLE_NAME environment variable not found');
      throw new Error('Users table name not configured');
    }
    
    console.log(`🔍 Checking email duplication in table: ${usersTableName}`);
    console.log(`📧 Email to check: ${email}`);

    // Check for existing email in Users table
    const scanCommand = new ScanCommand({
      TableName: usersTableName,
      FilterExpression: 'email = :email AND active = :active',
      ExpressionAttributeValues: {
        ':email': { S: email.toLowerCase().trim() },
        ':active': { BOOL: true }
      },
      ProjectionExpression: 'id, email, #status',
      ExpressionAttributeNames: {
        '#status': 'status'
      }
    });

    const result = await dynamoClient.send(scanCommand);
    
    // Check if email already exists
    const isDuplicate = result.Items && result.Items.length > 0;
    
    if (isDuplicate) {
      const existingUser = result.Items![0];
      console.log(`❌ Email already exists: ${email}`);
      
      return {
        isDuplicate: true,
        message: `A user with email address "${email}" already exists in the system`,
        existingUserId: existingUser.id?.S || null
      };
    }

    // Email is available
    console.log(`✅ Email is available: ${email}`);
    
    return {
      isDuplicate: false,
      message: 'Email address is available',
      existingUserId: null
    };

  } catch (error) {
    console.error('❌ Error checking email duplication:', error);
    throw new Error(`Failed to check email duplication: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};