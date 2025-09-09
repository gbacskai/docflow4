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
   * Find user by Cognito user ID using GraphQL API
   */
  private async findUserByCognitoId(cognitoUserId: string): Promise<ExternalUser | null> {
    try {
      console.log(`🔍 Searching for user with cognitoUserId: ${cognitoUserId}`);
      
      const { data } = await this.client.models.User.list({
        filter: {
          cognitoUserId: {
            eq: cognitoUserId
          }
        }
      });
      
      if (!data || data.length === 0) {
        console.log(`❌ No user found with cognitoUserId: ${cognitoUserId}`);
        return null;
      }
      
      console.log(`✅ Found user: ${data[0].id}`);
      return data[0] as ExternalUser;
    } catch (error) {
      console.error('Error finding user by Cognito ID:', error);
      return null;
    }
  }
  
  /**
   * Find user by email address (typically invitation records) using GraphQL API
   */
  private async findUserByEmail(email: string): Promise<ExternalUser | null> {
    try {
      console.log(`🔍 Searching for invited user with email: ${email}`);
      
      const { data } = await this.client.models.User.list({
        filter: {
          and: [
            {
              email: {
                eq: email.toLowerCase()
              }
            },
            {
              status: {
                eq: 'invited'
              }
            }
          ]
        }
      });
      
      if (!data || data.length === 0) {
        console.log(`❌ No invited user found with email: ${email}`);
        return null;
      }
      
      console.log(`✅ Found invited user: ${data[0].id}`);
      return data[0] as ExternalUser;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }
  
  /**
   * Create a new user record from an existing invitation using GraphQL API
   */
  private async createUserFromInvitation(
    cognitoUserId: string, 
    invitationRecord: ExternalUser,
    username: string
  ): Promise<ExternalUser> {
    
    // Check if this is the first user - if so, make them an admin regardless of invitation userType
    const isFirst = await this.isFirstUser();
    const userType = isFirst ? 'admin' : (invitationRecord.userType || 'client');
    
    const newUserData = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      version: new Date().toISOString(),
      email: invitationRecord.email,
      firstName: invitationRecord.firstName || '',
      lastName: invitationRecord.lastName || '',
      userType: userType as 'admin' | 'client' | 'provider',
      interestedDocumentTypes: invitationRecord.interestedDocumentTypes || [],
      status: 'active' as const, // Change from 'invited' to 'active'
      cognitoUserId: cognitoUserId, // Link to Cognito user
      invitedBy: invitationRecord.invitedBy,
      invitedAt: invitationRecord.invitedAt,
      lastLoginAt: new Date().toISOString(),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log(`💾 Creating user:`, newUserData.id);
    
    const { data } = await this.client.models.User.create(newUserData);
    
    console.log(isFirst ? '👑 First user created as admin' : '👤 User created from invitation');
    
    return data as ExternalUser;
  }
  
  /**
   * Create a completely new user record (no prior invitation) using GraphQL API
   */
  private async createNewUser(
    cognitoUserId: string, 
    email: string, 
    username: string
  ): Promise<ExternalUser> {
    
    // Check if this is the first user - if so, make them an admin
    const userType = await this.isFirstUser() ? 'admin' : 'client';
    
    const newUserData = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      version: new Date().toISOString(),
      email: email,
      firstName: '',
      lastName: '',
      userType: userType as 'admin' | 'client' | 'provider',
      interestedDocumentTypes: [],
      status: 'active' as const,
      cognitoUserId: cognitoUserId, // Link to Cognito user
      lastLoginAt: new Date().toISOString(),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log(`💾 Creating new user:`, newUserData.id);
    
    const { data } = await this.client.models.User.create(newUserData);
    
    console.log(userType === 'admin' ? '👑 First user created as admin' : '👤 New user created');
    
    return data as ExternalUser;
  }
  
  /**
   * Check if this is the first user in the system using GraphQL API
   */
  private async isFirstUser(): Promise<boolean> {
    try {
      console.log(`🔍 Checking for existing active users`);
      
      const { data } = await this.client.models.User.list({
        filter: {
          and: [
            {
              status: {
                eq: 'active'
              }
            },
            {
              cognitoUserId: {
                attributeExists: true
              }
            }
          ]
        }
      });
      
      const activeUserCount = data?.length || 0;
      const isFirst = activeUserCount === 0;
      console.log(`🔢 Active users count: ${activeUserCount}, isFirst: ${isFirst}`);
      
      return isFirst;
    } catch (error) {
      console.error('Error checking if first user:', error);
      return false; // Safer default
    }
  }
  
  /**
   * Update last login time for existing user using GraphQL API
   */
  async updateLastLogin(cognitoUserId: string): Promise<void> {
    try {
      const user = await this.findUserByCognitoId(cognitoUserId);
      
      if (user) {
        const { data } = await this.client.models.User.update({
          id: user.id,
          version: user.version,
          lastLoginAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        console.log('✅ Updated last login time for user:', user.id);
      }
    } catch (error) {
      console.error('Error updating last login:', error);
      // Don't throw - this shouldn't break the auth flow
    }
  }
  
  /**
   * Clean up any remaining non-Cognito user records with the same email using GraphQL API
   */
  private async cleanupNonCognitoRecords(email: string, currentCognitoUserId: string): Promise<void> {
    try {
      console.log('🧹 Cleaning up non-Cognito records for:', email);
      
      const { data } = await this.client.models.User.list({
        filter: {
          and: [
            {
              email: {
                eq: email.toLowerCase()
              }
            },
            {
              or: [
                {
                  cognitoUserId: {
                    attributeExists: false
                  }
                },
                {
                  cognitoUserId: {
                    ne: currentCognitoUserId
                  }
                }
              ]
            }
          ]
        }
      });
      
      if (!data || data.length === 0) {
        return;
      }
      
      console.log(`🗑️ Found ${data.length} records to clean up`);
      
      // For now, we'll just log this - implementing deletion would require additional operations
      data.forEach(record => {
        console.log(`🗑️ Would delete record: ${record.id} (${record.email})`);
      });
      
    } catch (error) {
      console.error('Error cleaning up non-Cognito records:', error);
      // Don't throw - cleanup failure shouldn't break the main authentication flow
    }
  }
}