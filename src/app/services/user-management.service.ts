import { Injectable, signal } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  
  /**
   * Ensures a user entry exists in the User table for the authenticated user.
   * This handles first-time login scenarios and invitation merging.
   * 
   * @param cognitoUserId - The Cognito user ID (sub)
   * @param email - The user's email address
   * @param username - The username from Cognito
   * @returns The user record from the User table
   */
  async ensureUserEntry(cognitoUserId: string, email: string, username: string): Promise<Schema['User']['type'] | null> {
    try {
      const client = generateClient<Schema>();
      
      console.log('🔍 Ensuring user entry for:', { cognitoUserId, email, username });
      
      // Step 1: Check if there's already a record with this Cognito user ID
      const existingUserByCognito = await this.findUserByCognitoId(client, cognitoUserId);
      
      if (existingUserByCognito) {
        console.log('✅ Found existing user by Cognito ID:', existingUserByCognito);
        
        // Clean up any other non-Cognito records with this email
        console.log('🔄 About to start cleanup process...');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('🔄 Starting cleanup after delay...');
        await this.cleanupNonCognitoRecords(client, email, cognitoUserId);
        console.log('🔄 Cleanup process completed');
        
        return existingUserByCognito;
      }
      
      // Step 2: Check if there's an invitation record for this email
      const invitationRecord = await this.findUserByEmail(client, email);
      
      if (invitationRecord) {
        console.log('📧 Found invitation record for email:', invitationRecord);
        
        // Step 3: Create new user record with Cognito ID and merge invitation data
        const newUserRecord = await this.createUserFromInvitation(
          client, 
          cognitoUserId, 
          invitationRecord,
          username
        );
        
        // Step 4: Remove the old invitation record
        await this.removeOldInvitationRecord(client, invitationRecord.id);
        
        // Step 5: Clean up any other non-Cognito records with this email
        // Add a small delay to ensure database consistency
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.cleanupNonCognitoRecords(client, email, cognitoUserId);
        
        console.log('✅ Created new user record and removed invitation:', newUserRecord);
        return newUserRecord;
      }
      
      // Step 3: No existing records - create a new user entry
      const newUser = await this.createNewUser(client, cognitoUserId, email, username);
      console.log('✅ Created new user record:', newUser);
      
      // Step 4: Clean up any remaining non-Cognito records with this email
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.cleanupNonCognitoRecords(client, email, cognitoUserId);
      
      return newUser;
      
    } catch (error) {
      console.error('❌ Error ensuring user entry:', error);
      return null;
    }
  }
  
  /**
   * Find user by Cognito user ID
   */
  private async findUserByCognitoId(client: any, cognitoUserId: string): Promise<Schema['User']['type'] | null> {
    try {
      const { data: users } = await client.models.User.list();
      
      // Look for a user with the matching Cognito user ID
      const existingUser = users.find((user: Schema['User']['type']) => 
        user.cognitoUserId === cognitoUserId
      );
      
      return existingUser || null;
    } catch (error) {
      console.error('Error finding user by Cognito ID:', error);
      return null;
    }
  }
  
  /**
   * Find user by email address (typically invitation records)
   */
  private async findUserByEmail(client: any, email: string): Promise<Schema['User']['type'] | null> {
    try {
      const { data: users } = await client.models.User.list();
      
      // Look for a user with matching email (typically invitation records)
      const existingUser = users.find((user: Schema['User']['type']) => 
        user.email && user.email.toLowerCase() === email.toLowerCase() &&
        user.status === 'invited'
      );
      
      return existingUser || null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }
  
  /**
   * Create a new user record from an existing invitation
   */
  private async createUserFromInvitation(
    client: any, 
    cognitoUserId: string, 
    invitationRecord: Schema['User']['type'],
    username: string
  ): Promise<Schema['User']['type']> {
    
    // Check if this is the first user - if so, make them an admin regardless of invitation userType
    const isFirst = await this.isFirstUser(client);
    const userType = isFirst ? 'admin' : (invitationRecord.userType || 'client');
    
    const newUserData = {
      email: invitationRecord.email,
      firstName: invitationRecord.firstName || '',
      lastName: invitationRecord.lastName || '',
      userType: userType,
      interestedDocumentTypes: invitationRecord.interestedDocumentTypes || [],
      status: 'active', // Change from 'invited' to 'active'
      cognitoUserId: cognitoUserId, // Link to Cognito user
      invitedBy: invitationRecord.invitedBy,
      invitedAt: invitationRecord.invitedAt,
      lastLoginAt: new Date().toISOString(),
      createdAt: invitationRecord.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const { data: newUser } = await client.models.User.create(newUserData);
    
    if (isFirst && userType === 'admin') {
      console.log('🎉 First user registered from invitation - granted admin privileges:', newUser);
    }
    
    return newUser;
  }
  
  /**
   * Remove the old invitation record
   */
  private async removeOldInvitationRecord(client: any, recordId: string): Promise<void> {
    try {
      await client.models.User.delete({ id: recordId });
      console.log('🗑️  Removed old invitation record:', recordId);
    } catch (error) {
      console.error('Error removing old invitation record:', error);
      // Don't throw - this is cleanup, main flow should continue
    }
  }
  
  /**
   * Create a completely new user record (no prior invitation)
   */
  private async createNewUser(
    client: any, 
    cognitoUserId: string, 
    email: string, 
    username: string
  ): Promise<Schema['User']['type']> {
    
    // Check if this is the first user - if so, make them an admin
    const userType = await this.isFirstUser(client) ? 'admin' : 'client';
    
    const newUserData = {
      email: email,
      firstName: '',
      lastName: '',
      userType: userType,
      interestedDocumentTypes: [],
      status: 'active' as const,
      cognitoUserId: cognitoUserId, // Link to Cognito user
      invitedBy: null,
      invitedAt: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const { data: newUser } = await client.models.User.create(newUserData);
    
    if (userType === 'admin') {
      console.log('🎉 First user registered - granted admin privileges:', newUser);
    }
    
    return newUser;
  }
  
  /**
   * Check if this is the first user in the system
   * Returns true if no active users exist
   */
  private async isFirstUser(client: any): Promise<boolean> {
    try {
      const { data: users } = await client.models.User.list();
      
      // Count users who have status 'active' and are linked to Cognito accounts
      // This ensures we only count real registered users, not invitation records
      const activeUsers = users.filter((user: Schema['User']['type']) => 
        user.status === 'active' && user.cognitoUserId
      );
      
      const isFirst = activeUsers.length === 0;
      console.log(`🔍 First user check: ${isFirst ? 'YES' : 'NO'} (found ${activeUsers.length} active users)`);
      
      return isFirst;
    } catch (error) {
      console.error('Error checking if first user:', error);
      // On error, assume not first user (safer default)
      return false;
    }
  }

  /**
   * Update last login time for existing user
   */
  async updateLastLogin(cognitoUserId: string): Promise<void> {
    try {
      const client = generateClient<Schema>();
      
      // Find the user by Cognito user ID
      const user = await this.findUserByCognitoId(client, cognitoUserId);
      
      if (user) {
        await client.models.User.update({
          id: user.id,
          lastLoginAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        console.log('✅ Updated last login for user:', cognitoUserId);
      }
    } catch (error) {
      console.error('❌ Error updating last login:', error);
      // Don't throw - this shouldn't break the auth flow
    }
  }
  
  /**
   * Clean up any remaining non-Cognito user records with the same email
   * This ensures no duplicate or orphaned records remain after authentication
   */
  private async cleanupNonCognitoRecords(client: any, email: string, currentCognitoUserId: string): Promise<void> {
    console.log('🚨 CLEANUP FUNCTION CALLED - email:', email, 'cognitoUserId:', currentCognitoUserId);
    try {
      console.log('🧹 Starting cleanup for email:', email, 'currentCognitoUserId:', currentCognitoUserId);
      
      const { data: users } = await client.models.User.list();
      console.log(`📋 Total users found: ${users.length}`);
      
      // Log all users with the same email for debugging
      const sameEmailUsers = users.filter((user: Schema['User']['type']) => 
        user.email && user.email.toLowerCase() === email.toLowerCase()
      );
      console.log(`📧 Found ${sameEmailUsers.length} users with email ${email}:`);
      sameEmailUsers.forEach((u: Schema['User']['type'], index: number) => {
        console.log(`   User ${index + 1}:`, {
          id: u.id,
          email: u.email,
          cognitoUserId: u.cognitoUserId,
          status: u.status,
          firstName: u.firstName,
          lastName: u.lastName,
          createdAt: u.createdAt,
          invitedAt: u.invitedAt
        });
      });
      
      // Find records to delete: same email BUT wrong cognitoUserId (including null/undefined)
      console.log('🔍 STARTING FILTER PROCESS - will check each user...');
      const recordsToDelete = users.filter((user: Schema['User']['type']) => {
        const sameEmail = user.email && user.email.toLowerCase() === email.toLowerCase();
        const hasCorrectCognitoUserId = user.cognitoUserId === currentCognitoUserId;
        
        console.log(`🔍 Checking user ${user.id}:`, {
          email: user.email,
          sameEmail,
          recordId: user.id,
          cognitoUserId: user.cognitoUserId,
          currentCognitoUserId,
          hasCorrectCognitoUserId,
          shouldDelete: sameEmail && !hasCorrectCognitoUserId
        });
        
        // Delete if: same email AND does NOT have the correct cognitoUserId
        const shouldDelete = sameEmail && !hasCorrectCognitoUserId;
        
        if (shouldDelete) {
          console.log(`✅ MARKING FOR DELETION: ${user.id} (wrong/missing cognitoUserId)`);
        } else {
          console.log(`❌ KEEPING: ${user.id} (${hasCorrectCognitoUserId ? 'correct cognitoUserId' : 'different email'})`);
        }
        
        return shouldDelete;
      });
      
      console.log(`🔍 FILTER COMPLETE - ${recordsToDelete.length} records marked for deletion out of ${users.length} total users`);
      
      console.log(`🔍 Found ${recordsToDelete.length} records to cleanup for email: ${email}`);
      
      // Delete each record
      for (const record of recordsToDelete) {
        try {
          console.log(`🗑️  Attempting to delete record: ID=${record.id}, email=${record.email}, cognitoUserId=${record.cognitoUserId}`);
          const deleteResult = await client.models.User.delete({ id: record.id });
          console.log(`✅ Successfully deleted record: ${record.id}`, deleteResult);
        } catch (deleteError: any) {
          console.error(`❌ Failed to delete record ${record.id}:`, deleteError);
          console.error('Delete error details:', {
            errorName: deleteError?.name || 'Unknown',
            errorMessage: deleteError?.message || 'Unknown error',
            recordToDelete: {
              id: record.id,
              email: record.email,
              cognitoUserId: record.cognitoUserId
            }
          });
          // Continue with other deletions even if one fails
        }
      }
      
      if (recordsToDelete.length > 0) {
        console.log(`✅ Cleanup completed: processed ${recordsToDelete.length} records for ${email}`);
      } else {
        console.log(`ℹ️  No cleanup needed for ${email}`);
      }
      
    } catch (error) {
      console.error('❌ Error during cleanup of non-Cognito records:', error);
      console.error('Cleanup error details:', error);
      // Don't throw - cleanup failure shouldn't break the main authentication flow
    }
  }
  
  /**
   * Public method to manually trigger cleanup for testing/debugging
   * This can be called directly to test the cleanup functionality
   */
  async manualCleanup(email: string, cognitoUserId: string): Promise<void> {
    const client = generateClient<Schema>();
    await this.cleanupNonCognitoRecords(client, email, cognitoUserId);
  }

  /**
   * Test method to create a duplicate record for testing cleanup
   * WARNING: Only use for testing!
   */
  async createTestDuplicateUser(email: string): Promise<void> {
    try {
      const client = generateClient<Schema>();
      const duplicateUser = await client.models.User.create({
        email: email,
        firstName: 'Test',
        lastName: 'Duplicate',
        userType: 'client',
        interestedDocumentTypes: [],
        status: 'active',
        cognitoUserId: null, // No cognito ID - this should be cleaned up
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('🧪 Created test duplicate user:', duplicateUser);
    } catch (error) {
      console.error('❌ Failed to create test duplicate:', error);
    }
  }

  /**
   * Debug method to show all users with a specific email
   */
  async debugUsersByEmail(email: string): Promise<any[]> {
    try {
      const client = generateClient<Schema>();
      const { data: users } = await client.models.User.list();
      
      const matchingUsers = users.filter(user => 
        user.email && user.email.toLowerCase() === email.toLowerCase()
      );
      
      console.log(`🔍 DEBUG: Found ${matchingUsers.length} users with email ${email}:`);
      matchingUsers.forEach((user: Schema['User']['type'], index: number) => {
        console.log(`User ${index + 1}:`, {
          id: user.id,
          email: user.email,
          cognitoUserId: user.cognitoUserId,
          status: user.status,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          invitedAt: user.invitedAt
        });
      });
      
      return matchingUsers;
    } catch (error) {
      console.error('Error debugging users by email:', error);
      return [];
    }
  }
}