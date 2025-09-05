import { Injectable, signal } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

export interface ExternalUser {
  id: string;
  version: string;
  email: string;
  userType?: 'admin' | 'client' | 'provider';
  firstName?: string;
  lastName?: string;
  interestedDocumentTypes?: string[];
  status: 'invited' | 'active' | 'inactive' | 'archived';
  emailVerified?: boolean;
  cognitoUserId?: string;
  invitedBy?: string;
  createdBy?: string;
  invitedAt?: string;
  lastLoginAt?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExternalUserService {
  private client = generateClient<Schema>();
  
  /**
   * Ensures a user entry exists in the external User table for the authenticated user.
   * This handles first-time login scenarios and invitation merging.
   */
  async ensureUserEntry(cognitoUserId: string, email: string, username: string): Promise<ExternalUser | null> {
    try {
      console.log('🔍 Ensuring user entry for:', { cognitoUserId, email, username });
      
      // Step 1: Check if there's already a record with this Cognito user ID
      const existingUserByCognito = await this.findUserByCognitoId(cognitoUserId);
      
      if (existingUserByCognito) {
        console.log('✅ Found existing user by Cognito ID:', existingUserByCognito.id);
        // Clean up any other non-Cognito records with this email
        await this.cleanupNonCognitoRecords(email, cognitoUserId);
        return existingUserByCognito;
      }
      
      // Step 2: Check if there's an invitation record for this email
      const invitationRecord = await this.findUserByEmail(email);
      
      if (invitationRecord) {
        console.log('📧 Found invitation record:', invitationRecord.id);
        
        // Step 3: Create new user record with Cognito ID and merge invitation data
        const newUserRecord = await this.createUserFromInvitation(
          cognitoUserId, 
          invitationRecord,
          username
        );
        
        // Step 4: Clean up old invitation record and duplicates
        await this.cleanupNonCognitoRecords(email, cognitoUserId);
        
        return newUserRecord;
      }
      
      // Step 3: No existing records - create a new user entry
      console.log('🆕 Creating new user record');
      const newUser = await this.createNewUser(cognitoUserId, email, username);
      
      return newUser;
      
    } catch (error) {
      console.error('❌ Error ensuring user entry:', error);
      return null;
    }
  }
  
  /**
   * Find user by Cognito user ID
   */
  private async findUserByCognitoId(cognitoUserId: string): Promise<ExternalUser | null> {
    try {
      const result = await this.client.models.User.list();
      
      if (!result.data) {
        return null;
      }
      
      const users = result.data;
      const user = users.find(user => user.cognitoUserId === cognitoUserId);
      
      return user ? user as ExternalUser : null;
    } catch (error) {
      console.error('Error finding user by Cognito ID:', error);
      return null;
    }
  }
  
  /**
   * Find user by email address (typically invitation records)
   */
  private async findUserByEmail(email: string): Promise<ExternalUser | null> {
    try {
      const result = await this.client.models.User.list();
      
      if (!result.data) {
        return null;
      }
      
      const users = result.data;
      const user = users.find(user => 
        user.email && user.email.toLowerCase() === email.toLowerCase() &&
        user.status === 'invited'
      );
      
      return user ? user as ExternalUser : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }
  
  /**
   * Create a new user record from an existing invitation
   */
  private async createUserFromInvitation(
    cognitoUserId: string, 
    invitationRecord: ExternalUser,
    username: string
  ): Promise<ExternalUser> {
    
    // Check if this is the first user - if so, make them an admin regardless of invitation userType
    const isFirst = await this.isFirstUser();
    const userType = isFirst ? 'admin' : (invitationRecord.userType || 'client');
    
    const result = await this.client.models.User.create({
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      version: new Date().toISOString()
    });
    
    if (!result.data) {
      throw new Error('Failed to create user from invitation');
    }
    
    console.log(isFirst ? '👑 First user created as admin' : '👤 User created from invitation');
    
    return result.data as ExternalUser;
  }
  
  /**
   * Create a completely new user record (no prior invitation)
   */
  private async createNewUser(
    cognitoUserId: string, 
    email: string, 
    username: string
  ): Promise<ExternalUser> {
    
    // Check if this is the first user - if so, make them an admin
    const userType = await this.isFirstUser() ? 'admin' : 'client';
    
    const result = await this.client.models.User.create({
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: email,
      firstName: '',
      lastName: '',
      userType: userType,
      interestedDocumentTypes: [],
      status: 'active',
      cognitoUserId: cognitoUserId, // Link to Cognito user
      lastLoginAt: new Date().toISOString(),
      version: new Date().toISOString()
    });
    
    if (!result.data) {
      throw new Error('Failed to create new user');
    }
    
    console.log(userType === 'admin' ? '👑 First user created as admin' : '👤 New user created');
    
    return result.data as ExternalUser;
  }
  
  /**
   * Check if this is the first user in the system
   */
  private async isFirstUser(): Promise<boolean> {
    try {
      const result = await this.client.models.User.list();
      
      if (!result.data) {
        return true; // No users found, so this would be the first
      }
      
      const users = result.data;
      
      // Count users who have status 'active' and are linked to Cognito accounts
      const activeUsers = users.filter(user => 
        user.status === 'active' && user.cognitoUserId
      );
      
      const isFirst = activeUsers.length === 0;
      console.log(`🔢 Active users count: ${activeUsers.length}, isFirst: ${isFirst}`);
      
      return isFirst;
    } catch (error) {
      console.error('Error checking if first user:', error);
      return false; // Safer default
    }
  }
  
  /**
   * Update last login time for existing user
   */
  async updateLastLogin(cognitoUserId: string): Promise<void> {
    try {
      const user = await this.findUserByCognitoId(cognitoUserId);
      
      if (user) {
        await this.client.models.User.update({
          id: user.id,
          version: user.version,
          lastLoginAt: new Date().toISOString()
        });
        console.log('✅ Updated last login time for user:', user.id);
      }
    } catch (error) {
      console.error('Error updating last login:', error);
      // Don't throw - this shouldn't break the auth flow
    }
  }
  
  /**
   * Clean up any remaining non-Cognito user records with the same email
   */
  private async cleanupNonCognitoRecords(email: string, currentCognitoUserId: string): Promise<void> {
    try {
      console.log('🧹 Cleaning up non-Cognito records for:', email);
      
      const result = await this.client.models.User.list();
      if (!result.data) {
        return;
      }
      
      const users = result.data;
      
      // Find records to delete: same email BUT wrong cognitoUserId (including null/undefined)
      const recordsToDelete = users.filter(user => {
        const sameEmail = user.email && user.email.toLowerCase() === email.toLowerCase();
        const hasCorrectCognitoUserId = user.cognitoUserId === currentCognitoUserId;
        
        return sameEmail && !hasCorrectCognitoUserId;
      });
      
      console.log(`🗑️ Found ${recordsToDelete.length} records to clean up`);
      
      // For now, we'll just log this - implementing deletion would require additional resolvers
      recordsToDelete.forEach(record => {
        console.log(`🗑️ Would delete record: ${record.id} (${record.email})`);
      });
      
    } catch (error) {
      console.error('Error cleaning up non-Cognito records:', error);
      // Don't throw - cleanup failure shouldn't break the main authentication flow
    }
  }
}