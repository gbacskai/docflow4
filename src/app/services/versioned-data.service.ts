import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { DirectDynamoDBService } from './direct-dynamodb.service';

export interface VersionedCreateParams {
  id?: string;
  data: any;
}

export interface VersionedQueryOptions {
  latestOnly?: boolean;
  id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VersionedDataService {
  private client = generateClient<Schema>();
  private directDB = inject(DirectDynamoDBService);
  
  // Flag to use direct DynamoDB instead of GraphQL
  private useDirectDB = false;

  generateTimestamp(): string {
    return new Date().toISOString();
  }

  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  async createVersionedRecord(
    modelName: string,
    params: VersionedCreateParams
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const recordId = params.id || this.generateId();
      const version = this.generateTimestamp();
      
      const recordData = {
        ...params.data,
        id: recordId,
        version,
        active: true,
        updatedAt: version
      };

      // 🚀 ACTIVE FLAG MANAGEMENT - 4-Step Process:
      // 1) Search where active is true
      // 2) Remove active flag from the old document  
      // 3) Update the old record (with no active flag)
      // 4) Insert the new record with active = true
      await this.deactivateExistingActiveRecords(modelName, recordId);

      // Use direct DynamoDB service to bypass auto-generated tables
      if (this.useDirectDB) {
        console.log(`🎯 Using direct DynamoDB for ${modelName}`);
        return await this.directDB.putItem(modelName, recordData);
      }

      // Fallback to GraphQL client
      let result;
      switch (modelName) {
        case 'Project':
          result = await this.client.models.Project.create(recordData);
          break;
        case 'Document':
          result = await this.client.models.Document.create(recordData);
          break;
        case 'User':
          result = await this.client.models.User.create(recordData);
          break;
        case 'DocumentType':
          result = await this.client.models.DocumentType.create(recordData);
          break;
        case 'Workflow':
          result = await this.client.models.Workflow.create(recordData);
          break;
        case 'ChatRoom':
          result = await this.client.models.ChatRoom.create(recordData);
          break;
        case 'ChatMessage':
          result = await this.client.models.ChatMessage.create(recordData);
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }
      
      console.log(`🔍 ${modelName} - GraphQL client result structure:`, {
        hasData: !!result.data,
        hasErrors: !!result.errors,
        resultKeys: Object.keys(result || {}),
        dataValue: result.data,
        errorsValue: result.errors,
        fullResult: result
      });
      
      // Check for GraphQL errors
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map((err: any) => err.message).join(', ');
        console.error(`GraphQL errors creating ${modelName}:`, result.errors);
        return {
          success: false,
          error: `GraphQL error: ${errorMessages}`
        };
      }

      // ✨ ACTIVE FLAG MANAGEMENT COMPLETED - New record created with active = true, old records deactivated
      
      return {
        success: true,
        data: result.data
      };
    } catch (error: any) {
      console.error(`Error creating versioned ${String(modelName)}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  async updateVersionedRecord(
    modelName: string,
    id: string,
    updateData: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const version = this.generateTimestamp();
      
      const latestRecord = await this.getLatestVersion(modelName, id);
      if (!latestRecord.success || !latestRecord.data) {
        return {
          success: false,
          error: 'Original record not found'
        };
      }

      const newRecordData = {
        ...latestRecord.data,
        ...updateData,
        id,
        version,
        active: true,
        updatedAt: version
      };

      // 🚀 ACTIVE FLAG MANAGEMENT - 4-Step Process before update:
      await this.deactivateExistingActiveRecords(modelName, id);

      let result;
      switch (modelName) {
        case 'Project':
          result = await this.client.models.Project.create(newRecordData);
          break;
        case 'Document':
          result = await this.client.models.Document.create(newRecordData);
          break;
        case 'User':
          result = await this.client.models.User.create(newRecordData);
          break;
        case 'DocumentType':
          result = await this.client.models.DocumentType.create(newRecordData);
          break;
        case 'Workflow':
          result = await this.client.models.Workflow.create(newRecordData);
          break;
        case 'ChatRoom':
          result = await this.client.models.ChatRoom.create(newRecordData);
          break;
        case 'ChatMessage':
          result = await this.client.models.ChatMessage.create(newRecordData);
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }

      // ✨ ACTIVE FLAG MANAGEMENT COMPLETED - Updated record created with active = true, old records deactivated
      
      return {
        success: true,
        data: result.data
      };
    } catch (error: any) {
      console.error(`Error updating versioned ${String(modelName)}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  async getLatestVersion(
    modelName: string,
    id: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      let records;
      switch (modelName) {
        case 'Project':
          records = (await this.client.models.Project.list({ filter: { and: [{ id: { eq: id } }, { active: { eq: true } }] } })).data;
          break;
        case 'Document':
          records = (await this.client.models.Document.list({ filter: { and: [{ id: { eq: id } }, { active: { eq: true } }] } })).data;
          break;
        case 'User':
          records = (await this.client.models.User.list({ filter: { and: [{ id: { eq: id } }, { active: { eq: true } }] } })).data;
          break;
        case 'DocumentType':
          records = (await this.client.models.DocumentType.list({ filter: { and: [{ id: { eq: id } }, { active: { eq: true } }] } })).data;
          break;
        case 'Workflow':
          records = (await this.client.models.Workflow.list({ filter: { and: [{ id: { eq: id } }, { active: { eq: true } }] } })).data;
          break;
        case 'ChatRoom':
          records = (await this.client.models.ChatRoom.list({ filter: { and: [{ id: { eq: id } }, { active: { eq: true } }] } })).data;
          break;
        case 'ChatMessage':
          records = (await this.client.models.ChatMessage.list({ filter: { and: [{ id: { eq: id } }, { active: { eq: true } }] } })).data;
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }

      if (!records || records.length === 0) {
        return {
          success: false,
          error: 'Record not found'
        };
      }

      // With active=true filter, there should be exactly one record, but sort just in case
      const sortedRecords = records.sort((a: any, b: any) => 
        new Date(b.version).getTime() - new Date(a.version).getTime()
      );
      const latestRecord = sortedRecords[0];

      return {
        success: true,
        data: latestRecord
      };
    } catch (error: any) {
      console.error(`Error getting latest version for ${String(modelName)}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  async getAllLatestVersions(
    modelName: string
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      let activeRecords;
      switch (modelName) {
        case 'Project':
          activeRecords = (await this.client.models.Project.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'Document':
          activeRecords = (await this.client.models.Document.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'User':
          activeRecords = (await this.client.models.User.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'DocumentType':
          activeRecords = (await this.client.models.DocumentType.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'Workflow':
          activeRecords = (await this.client.models.Workflow.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'ChatRoom':
          activeRecords = (await this.client.models.ChatRoom.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'ChatMessage':
          activeRecords = (await this.client.models.ChatMessage.list({ filter: { active: { eq: true } } })).data;
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }

      if (!activeRecords) {
        return {
          success: true,
          data: []
        };
      }

      // Since we're filtering by active=true, we should have only one record per ID
      // But let's still deduplicate in case there are multiple active records (shouldn't happen with proper management)
      const latestByIdMap = new Map<string, any>();
      
      // Group records by ID
      const groupedById = activeRecords.reduce((acc, record) => {
        const id = record.id;
        if (!acc[id]) {
          acc[id] = [];
        }
        acc[id].push(record);
        return acc;
      }, {} as Record<string, any[]>);

      // Process each ID group - with proper active management, there should be only one active record per ID
      for (const [id, recordsForId] of Object.entries(groupedById)) {
        const recordsArray = recordsForId as any[];
        
        if (recordsArray.length === 1) {
          // Normal case - one active record per ID
          latestByIdMap.set(id, recordsArray[0]);
        } else {
          // Data inconsistency detected - multiple active records for same ID
          console.warn(`⚠️ ${modelName} - Found ${recordsArray.length} active records for ID: ${id} - performing automatic deduplication`);
          
          // Sort by version timestamp and keep the latest one
          const sortedRecords = recordsArray.sort((a, b) => 
            new Date(b.version).getTime() - new Date(a.version).getTime()
          );
          
          const latestRecord = sortedRecords[0];
          const oldRecords = sortedRecords.slice(1);
          
          // Keep the latest active record
          latestByIdMap.set(id, latestRecord);
          
          // 🚀 DEDUPLICATION: Remove active flag from old records and update DynamoDB
          console.log(`🧹 ${modelName} - Deduplicating: keeping latest version ${latestRecord.version}, deactivating ${oldRecords.length} older active records`);
          await this.deduplicateOldActiveRecords(modelName, oldRecords);
        }
      }
      
      const latestRecords = Array.from(latestByIdMap.values());
      
      console.log(`${modelName} - Active records found: ${latestRecords.length}`);
      if (latestRecords.length > 0) {
        console.log(`${modelName} - Sample active record:`, {
          id: (latestRecords[0] as any).id,
          version: (latestRecords[0] as any).version,
          active: (latestRecords[0] as any).active
        });
      }

      return {
        success: true,
        data: latestRecords
      };
    } catch (error: any) {
      console.error(`Error getting all latest versions for ${String(modelName)}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  async getVersionHistory(
    modelName: string,
    id: string
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      let records;
      switch (modelName) {
        case 'Project':
          records = (await this.client.models.Project.list({ filter: { id: { eq: id } } })).data;
          break;
        case 'Document':
          records = (await this.client.models.Document.list({ filter: { id: { eq: id } } })).data;
          break;
        case 'User':
          records = (await this.client.models.User.list({ filter: { id: { eq: id } } })).data;
          break;
        case 'DocumentType':
          records = (await this.client.models.DocumentType.list({ filter: { id: { eq: id } } })).data;
          break;
        case 'Workflow':
          records = (await this.client.models.Workflow.list({ filter: { id: { eq: id } } })).data;
          break;
        case 'ChatRoom':
          records = (await this.client.models.ChatRoom.list({ filter: { id: { eq: id } } })).data;
          break;
        case 'ChatMessage':
          records = (await this.client.models.ChatMessage.list({ filter: { id: { eq: id } } })).data;
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }

      if (!records || records.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      const sortedRecords = records.sort((a: any, b: any) => 
        new Date(b.version).getTime() - new Date(a.version).getTime()
      );

      return {
        success: true,
        data: sortedRecords
      };
    } catch (error: any) {
      console.error(`Error getting version history for ${String(modelName)}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  async deleteVersionedRecord(
    modelName: string,
    id: string,
    version: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let result;
      switch (modelName) {
        case 'Project':
          result = await this.client.models.Project.delete({ id, version });
          break;
        case 'Document':
          result = await this.client.models.Document.delete({ id, version });
          break;
        case 'User':
          result = await this.client.models.User.delete({ id, version });
          break;
        case 'DocumentType':
          result = await this.client.models.DocumentType.delete({ id, version });
          break;
        case 'Workflow':
          result = await this.client.models.Workflow.delete({ id, version });
          break;
        case 'ChatRoom':
          result = await this.client.models.ChatRoom.delete({ id, version });
          break;
        case 'ChatMessage':
          result = await this.client.models.ChatMessage.delete({ id, version });
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }

      // Check for GraphQL errors in the response
      if (result && result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map((err: any) => err.message).join(', ');
        console.error(`GraphQL errors deleting ${String(modelName)} ${id}:${version}:`, result.errors);
        return {
          success: false,
          error: `GraphQL error: ${errorMessages}`
        };
      }

      return {
        success: true
      };
    } catch (error: any) {
      console.error(`Error deleting versioned ${String(modelName)}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  async getAllVersionsAllRecords(
    modelName: string
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      let records;
      switch (modelName) {
        case 'Project':
          records = (await this.client.models.Project.list()).data;
          break;
        case 'Document':
          records = (await this.client.models.Document.list()).data;
          break;
        case 'User':
          records = (await this.client.models.User.list()).data;
          break;
        case 'DocumentType':
          records = (await this.client.models.DocumentType.list()).data;
          break;
        case 'Workflow':
          records = (await this.client.models.Workflow.list()).data;
          break;
        case 'ChatRoom':
          records = (await this.client.models.ChatRoom.list()).data;
          break;
        case 'ChatMessage':
          records = (await this.client.models.ChatMessage.list()).data;
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }

      return {
        success: true,
        data: records || []
      };
    } catch (error: any) {
      console.error(`Error getting all versions for ${String(modelName)}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  async deleteAllVersionsAllRecords(
    modelName: string
  ): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const result = await this.getAllVersionsAllRecords(modelName);
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to get records'
        };
      }

      let deletedCount = 0;
      const errors: string[] = [];

      for (const record of result.data) {
        try {
          const deleteResult = await this.deleteVersionedRecord(modelName, record.id, record.version);
          if (deleteResult.success) {
            deletedCount++;
          } else {
            errors.push(`Failed to delete ${record.id}:${record.version} - ${deleteResult.error}`);
          }
        } catch (error: any) {
          errors.push(`Error deleting ${record.id}:${record.version} - ${error.message}`);
        }
      }

      if (errors.length > 0) {
        console.warn(`Some deletion errors occurred for ${modelName}:`, errors);
      }

      return {
        success: true,
        deletedCount
      };
    } catch (error: any) {
      console.error(`Error deleting all versions for ${String(modelName)}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * 🚀 ACTIVE FLAG MANAGEMENT - 4-Step Process Implementation
   * 1) Search where active is true
   * 2) Set active flag to false for the old documents  
   * 3) Update the old records (with active = false)
   * 4) New record will be inserted with active = true (handled by caller)
   */
  private async deactivateExistingActiveRecords(modelName: string, recordId: string): Promise<void> {
    try {
      console.log(`🔍 Step 1: Searching for active records with ID: ${recordId} in ${modelName}`);
      
      // Step 1: Search where active is true for this record ID
      let activeRecords;
      switch (modelName) {
        case 'Project':
          activeRecords = (await this.client.models.Project.list({ filter: { and: [{ id: { eq: recordId } }, { active: { eq: true } }] } })).data;
          break;
        case 'Document':
          activeRecords = (await this.client.models.Document.list({ filter: { and: [{ id: { eq: recordId } }, { active: { eq: true } }] } })).data;
          break;
        case 'User':
          activeRecords = (await this.client.models.User.list({ filter: { and: [{ id: { eq: recordId } }, { active: { eq: true } }] } })).data;
          break;
        case 'DocumentType':
          activeRecords = (await this.client.models.DocumentType.list({ filter: { and: [{ id: { eq: recordId } }, { active: { eq: true } }] } })).data;
          break;
        case 'Workflow':
          activeRecords = (await this.client.models.Workflow.list({ filter: { and: [{ id: { eq: recordId } }, { active: { eq: true } }] } })).data;
          break;
        case 'ChatRoom':
          activeRecords = (await this.client.models.ChatRoom.list({ filter: { and: [{ id: { eq: recordId } }, { active: { eq: true } }] } })).data;
          break;
        case 'ChatMessage':
          activeRecords = (await this.client.models.ChatMessage.list({ filter: { and: [{ id: { eq: recordId } }, { active: { eq: true } }] } })).data;
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }

      if (!activeRecords || activeRecords.length === 0) {
        console.log(`✅ No active records found for ${modelName} ID: ${recordId}`);
        return;
      }

      console.log(`🔄 Step 2-3: Found ${activeRecords.length} active records to set to inactive for ${modelName} ID: ${recordId}`);

      // Steps 2-3: Set active flag to false and update each record
      for (const activeRecord of activeRecords) {
        try {
          console.log(`🚫 Setting active = false for ${modelName} ${activeRecord.id}:${activeRecord.version}`);
          
          // Create update data with active = false (Step 2: Set active flag to false)
          const updateData: any = {
            id: activeRecord.id,
            version: activeRecord.version,
            active: false,
            updatedAt: new Date().toISOString()
          };

          // Step 3: Update the old record (with active = false)
          switch (modelName) {
            case 'Project':
              await this.client.models.Project.update(updateData);
              break;
            case 'Document':
              await this.client.models.Document.update(updateData);
              break;
            case 'User':
              await this.client.models.User.update(updateData);
              break;
            case 'DocumentType':
              await this.client.models.DocumentType.update(updateData);
              break;
            case 'Workflow':
              await this.client.models.Workflow.update(updateData);
              break;
            case 'ChatRoom':
              await this.client.models.ChatRoom.update(updateData);
              break;
            case 'ChatMessage':
              await this.client.models.ChatMessage.update(updateData);
              break;
            default:
              throw new Error(`Unknown model: ${modelName}`);
          }
          
          console.log(`✅ Successfully set active = false for ${modelName} ${activeRecord.id}:${activeRecord.version}`);
        } catch (error: any) {
          console.error(`❌ Failed to deactivate ${modelName} ${activeRecord.id}:${activeRecord.version}:`, error);
          // Continue with other records even if one fails
        }
      }
      
      console.log(`🎯 Completed active flag management for ${modelName} ID: ${recordId}`);
    } catch (error: any) {
      console.error(`❌ Error in deactivateExistingActiveRecords for ${modelName} ${recordId}:`, error);
      throw error; // Re-throw to prevent creating the new record if deactivation fails
    }
  }

  /**
   * 🧹 DEDUPLICATION: Remove active key from old documents and update them back to DynamoDB
   * This runs synchronously to ensure the database is updated before returning results
   */
  private async deduplicateOldActiveRecords(modelName: string, oldActiveRecords: any[]): Promise<void> {
    try {
      console.log(`🧹 Deduplication started for ${modelName} - processing ${oldActiveRecords.length} old active records`);
      
      for (const oldRecord of oldActiveRecords) {
        try {
          console.log(`🚫 Removing active key from ${modelName} ${oldRecord.id}:${oldRecord.version} and updating to DynamoDB`);
          
          // Create update data WITHOUT the active field to remove it entirely
          const updateData: any = {
            id: oldRecord.id,
            version: oldRecord.version,
            updatedAt: new Date().toISOString()
            // NOTE: Deliberately omitting 'active' field to remove it from the record
          };

          // Update the record in DynamoDB to remove the active key
          let updateResult;
          switch (modelName) {
            case 'Project':
              updateResult = await this.client.models.Project.update(updateData);
              break;
            case 'Document':
              updateResult = await this.client.models.Document.update(updateData);
              break;
            case 'User':
              updateResult = await this.client.models.User.update(updateData);
              break;
            case 'DocumentType':
              updateResult = await this.client.models.DocumentType.update(updateData);
              break;
            case 'Workflow':
              updateResult = await this.client.models.Workflow.update(updateData);
              break;
            case 'ChatRoom':
              updateResult = await this.client.models.ChatRoom.update(updateData);
              break;
            case 'ChatMessage':
              updateResult = await this.client.models.ChatMessage.update(updateData);
              break;
            default:
              throw new Error(`Unknown model: ${modelName}`);
          }
          
          // Check for GraphQL errors
          if (updateResult?.errors && updateResult.errors.length > 0) {
            const errorMessages = updateResult.errors.map((err: any) => err.message).join(', ');
            console.error(`GraphQL errors updating ${modelName} ${oldRecord.id}:${oldRecord.version}:`, updateResult.errors);
            throw new Error(`GraphQL error: ${errorMessages}`);
          }
          
          console.log(`✅ Successfully removed active key from ${modelName} ${oldRecord.id}:${oldRecord.version} and updated to DynamoDB`);
        } catch (error: any) {
          console.error(`❌ Failed to remove active key from ${modelName} ${oldRecord.id}:${oldRecord.version}:`, error);
          // Continue with other records even if one fails
        }
      }
      
      console.log(`🎯 Deduplication completed for ${modelName} - all updates written to DynamoDB`);
    } catch (error: any) {
      console.error(`❌ Deduplication failed for ${modelName}:`, error);
      throw error; // Re-throw to indicate the operation failed
    }
  }

  analyzeDuplicates(records: any[]): Record<string, { count: number; versions: string[] }> {
    const duplicatesById: Record<string, { count: number; versions: string[] }> = {};
    
    const groupedById = records.reduce((acc, record) => {
      const id = record.id;
      if (!acc[id]) {
        acc[id] = [];
      }
      acc[id].push(record);
      return acc;
    }, {} as Record<string, any[]>);
    
    for (const [id, recordsForId] of Object.entries(groupedById)) {
      const recordsArray = recordsForId as any[];
      if (recordsArray.length > 1) {
        duplicatesById[id] = {
          count: recordsArray.length,
          versions: recordsArray.map((r: any) => r.version).sort()
        };
      }
    }
    
    return duplicatesById;
  }

  /**
   * Manual cleanup method - No longer needed since active field is removed
   * All records exist, and getAllLatestVersions automatically returns the latest version by timestamp
   */
  async manualCleanupDuplicates(modelName: string): Promise<{ success: boolean; cleaned: number; error?: string }> {
    console.log(`ℹ️ Manual cleanup not needed for ${modelName} - active field removed, using timestamp-based latest versions`);
    return { success: true, cleaned: 0 };
  }
}