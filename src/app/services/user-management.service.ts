import { Injectable, signal, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { VersionedDataService } from './versioned-data.service';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private versionedDataService = inject(VersionedDataService);
  
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
      
      
      // Step 1: Check if there's already a record with this Cognito user ID
      const existingUserByCognito = await this.findUserByCognitoId(client, cognitoUserId);
      
      if (existingUserByCognito) {
        
        // Clean up any other non-Cognito records with this email
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.cleanupNonCognitoRecords(client, email, cognitoUserId);
        
        return existingUserByCognito;
      }
      
      // Step 2: Check if there's an invitation record for this email
      const invitationRecord = await this.findUserByEmail(client, email);
      
      if (invitationRecord) {
        
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
        
        return newUserRecord;
      }
      
      // Step 3: No existing records - create a new user entry
      const newUser = await this.createNewUser(client, cognitoUserId, email, username);
      
      // Step 4: Clean up any remaining non-Cognito records with this email
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.cleanupNonCognitoRecords(client, email, cognitoUserId);
      
      return newUser;
      
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Find user by Cognito user ID
   */
  private async findUserByCognitoId(client: any, cognitoUserId: string): Promise<Schema['User']['type'] | null> {
    try {
      const result = await this.versionedDataService.getAllLatestVersions('User');
      
      if (!result.success || !result.data) {
        return null;
      }
      
      // Look for a user with the matching Cognito user ID
      const existingUser = result.data.find((user: Schema['User']['type']) => 
        user.cognitoUserId === cognitoUserId
      );
      
      return existingUser || null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Find user by email address (typically invitation records)
   */
  private async findUserByEmail(client: any, email: string): Promise<Schema['User']['type'] | null> {
    try {
      const result = await this.versionedDataService.getAllLatestVersions('User');
      
      if (!result.success || !result.data) {
        return null;
      }
      
      // Look for a user with matching email (typically invitation records)
      const existingUser = result.data.find((user: Schema['User']['type']) => 
        user.email && user.email.toLowerCase() === email.toLowerCase() &&
        user.status === 'invited'
      );
      
      return existingUser || null;
    } catch (error) {
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
      createdAt: invitationRecord.createdAt || new Date().toISOString()
    };
    
    const result = await this.versionedDataService.createVersionedRecord('User', { data: newUserData });
    if (!result.success) {
      throw new Error(result.error);
    }
    const newUser = result.data;
    
    if (isFirst && userType === 'admin') {
    }
    
    return newUser;
  }
  
  /**
   * Remove the old invitation record
   */
  private async removeOldInvitationRecord(client: any, recordId: string): Promise<void> {
    try {
      // Find the invitation record to get its version
      const result = await this.versionedDataService.getLatestVersion('User', recordId);
      if (result.success && result.data) {
        await this.versionedDataService.deleteVersionedRecord('User', recordId, result.data.version);
      }
    } catch (error) {
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
      createdAt: new Date().toISOString()
    };
    
    const result = await this.versionedDataService.createVersionedRecord('User', { data: newUserData });
    if (!result.success) {
      throw new Error(result.error);
    }
    const newUser = result.data;
    
    if (userType === 'admin') {
    }
    
    return newUser;
  }
  
  /**
   * Check if this is the first user in the system
   * Returns true if no active users exist
   */
  private async isFirstUser(client: any): Promise<boolean> {
    try {
      const result = await this.versionedDataService.getAllLatestVersions('User');
      
      if (!result.success || !result.data) {
        return true; // No users found, so this would be the first
      }
      
      // Count users who have status 'active' and are linked to Cognito accounts
      // This ensures we only count real registered users, not invitation records
      const activeUsers = result.data.filter((user: Schema['User']['type']) => 
        user.status === 'active' && user.cognitoUserId
      );
      
      const isFirst = activeUsers.length === 0;
      
      return isFirst;
    } catch (error) {
      // On error, assume not first user (safer default)
      return false;
    }
  }

  
  /**
   * Clean up any remaining non-Cognito user records with the same email
   * This ensures no duplicate or orphaned records remain after authentication
   */
  private async cleanupNonCognitoRecords(client: any, email: string, currentCognitoUserId: string): Promise<void> {
    try {
      
      const result = await this.versionedDataService.getAllLatestVersions('User');
      if (!result.success || !result.data) {
        return;
      }
      const users = result.data;
      
      // Find records to delete: same email BUT wrong cognitoUserId (including null/undefined)
      const recordsToDelete = users.filter((user: Schema['User']['type']) => {
        const sameEmail = user.email && user.email.toLowerCase() === email.toLowerCase();
        const hasCorrectCognitoUserId = user.cognitoUserId === currentCognitoUserId;
        
        // Delete if: same email AND does NOT have the correct cognitoUserId
        const shouldDelete = sameEmail && !hasCorrectCognitoUserId;
        
        return shouldDelete;
      });
      
      // Delete each record (all versions)
      for (const record of recordsToDelete) {
        try {
          await this.versionedDataService.deleteVersionedRecord('User', record.id, record.version);
        } catch (deleteError: any) {
          // Continue with other deletions even if one fails
        }
      }
      
    } catch (error) {
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
      await this.versionedDataService.createVersionedRecord('User', {
        data: {
          email: email,
          firstName: 'Test',
          lastName: 'Duplicate',
          userType: 'client',
          interestedDocumentTypes: [],
          status: 'active',
          cognitoUserId: null, // No cognito ID - this should be cleaned up
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
    }
  }

  /**
   * Debug method to show all users with a specific email
   */
  async debugUsersByEmail(email: string): Promise<any[]> {
    try {
      const result = await this.versionedDataService.getAllLatestVersions('User');
      
      if (!result.success || !result.data) {
        return [];
      }
      
      const matchingUsers = result.data.filter(user => 
        user.email && user.email.toLowerCase() === email.toLowerCase()
      );
      
      return matchingUsers;
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if email address already exists in the Users table
   * Uses Lambda function for efficient DynamoDB query
   */
  async checkEmailDuplicate(email: string): Promise<{ isDuplicate: boolean; error?: string }> {
    // TODO: Re-implement when Lambda function is enabled
    console.warn('checkEmailDuplicate is temporarily disabled');
    
    // For now, perform a simple client-side check
    try {
      const client = generateClient<Schema>();
      const result = await client.models.User.list({
        filter: {
          email: { eq: email.toLowerCase().trim() }
        }
      });
      
      // Get only the active version of each user (filter by active=true)
      const activeUsers = result.data?.filter(user => user.active === true) || [];
      const isDuplicate = activeUsers.length > 0;
      
      return { 
        isDuplicate,
        error: undefined
      };
      
    } catch (error) {
      console.error('Error checking email duplication:', error);
      return { 
        isDuplicate: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Validate email before creating user - throws error if duplicate exists
   */
  async validateEmailForCreation(email: string): Promise<void> {
    const result = await this.checkEmailDuplicate(email);
    
    if (result.isDuplicate) {
      throw new Error(result.error || 'Email address already exists in the system');
    }
    
    if (result.error) {
      console.warn('Email duplication check failed:', result.error);
      // Continue with creation if check failed (graceful degradation)
    }
  }
}