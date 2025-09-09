import { AppSyncResolverHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, ListUsersCommand, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';

interface DeleteAllCognitoUsersArgs {
  confirmDeletion: boolean;
}

interface DeleteAllCognitoUsersResult {
  success: boolean;
  deletedCount?: number;
  error?: string;
}

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler: AppSyncResolverHandler<DeleteAllCognitoUsersArgs, DeleteAllCognitoUsersResult> = async (event) => {
  console.log('Delete all Cognito users request:', event);
  
  try {
    const { confirmDeletion } = event.arguments;
    
    if (!confirmDeletion) {
      return {
        success: false,
        error: 'Deletion confirmation required'
      };
    }

    const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;
    if (!userPoolId) {
      return {
        success: false,
        error: 'User pool ID not configured'
      };
    }

    let deletedCount = 0;
    let nextToken: string | undefined;
    
    do {
      // List users in batches
      const listCommand = new ListUsersCommand({
        UserPoolId: userPoolId,
        Limit: 60, // AWS default max
        PaginationToken: nextToken
      });
      
      const listResult = await cognitoClient.send(listCommand);
      
      if (!listResult.Users || listResult.Users.length === 0) {
        break;
      }
      
      // Delete each user
      for (const user of listResult.Users) {
        try {
          if (user.Username) {
            const deleteCommand = new AdminDeleteUserCommand({
              UserPoolId: userPoolId,
              Username: user.Username
            });
            
            await cognitoClient.send(deleteCommand);
            deletedCount++;
            console.log(`Deleted user: ${user.Username}`);
          }
        } catch (deleteError: any) {
          console.error(`Failed to delete user ${user.Username}:`, deleteError);
          // Continue with other users even if one fails
        }
      }
      
      nextToken = listResult.PaginationToken;
    } while (nextToken);
    
    console.log(`Successfully deleted ${deletedCount} Cognito users`);
    
    return {
      success: true,
      deletedCount
    };
  } catch (error: any) {
    console.error('Error deleting Cognito users:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete Cognito users'
    };
  }
};