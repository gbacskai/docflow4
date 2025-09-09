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
  private useDirectDB = true;

  generateTimestamp(): string {
    return new Date().toISOString();
  }

  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

      // With active=true filter, there should be exactly one record
      const latestRecord = records[0];

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
      let latestRecords;
      switch (modelName) {
        case 'Project':
          latestRecords = (await this.client.models.Project.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'Document':
          latestRecords = (await this.client.models.Document.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'User':
          latestRecords = (await this.client.models.User.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'DocumentType':
          latestRecords = (await this.client.models.DocumentType.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'Workflow':
          latestRecords = (await this.client.models.Workflow.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'ChatRoom':
          latestRecords = (await this.client.models.ChatRoom.list({ filter: { active: { eq: true } } })).data;
          break;
        case 'ChatMessage':
          latestRecords = (await this.client.models.ChatMessage.list({ filter: { active: { eq: true } } })).data;
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }

      if (!latestRecords) {
        return {
          success: true,
          data: []
        };
      }

      // Filter to ensure only latest version per ID (in case Lambda function didn't process duplicates)
      const latestByIdMap = new Map<string, any>();
      
      for (const record of latestRecords) {
        const existingRecord = latestByIdMap.get(record.id);
        if (!existingRecord || new Date(record.version) > new Date(existingRecord.version)) {
          latestByIdMap.set(record.id, record);
        }
      }
      
      const deduplicatedRecords = Array.from(latestByIdMap.values());
      
      if (deduplicatedRecords.length !== latestRecords.length) {
        console.warn(`${modelName} - Found ${latestRecords.length} active records, deduplicated to ${deduplicatedRecords.length}. Lambda function may not be processing correctly.`);
        console.log(`${modelName} - Detailed duplicate info:`, {
          totalActive: latestRecords.length,
          afterDeduplication: deduplicatedRecords.length,
          duplicatesByID: this.analyzeDuplicates(latestRecords)
        });
        
        // Optionally trigger manual cleanup (but only in development)
        if (process.env['NODE_ENV'] === 'development') {
          console.log(`${modelName} - Development mode: Consider running manual cleanup for duplicate records`);
        }
      }
      
      console.log(`${modelName} - Latest active records found: ${deduplicatedRecords.length}`);
      if (deduplicatedRecords.length > 0) {
        console.log(`${modelName} - Sample latest record:`, {
          id: (deduplicatedRecords[0] as any).id,
          version: (deduplicatedRecords[0] as any).version,
          active: (deduplicatedRecords[0] as any).active
        });
      }

      return {
        success: true,
        data: deduplicatedRecords
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
   * Manual cleanup method for duplicate active records
   * This can be called when the Lambda function isn't processing correctly
   */
  async manualCleanupDuplicates(modelName: string): Promise<{ success: boolean; cleaned: number; error?: string }> {
    console.log(`🧹 Manual cleanup started for ${modelName}`);
    
    try {
      // Get all active records
      const allActiveResult = await this.getAllLatestVersions(modelName);
      if (!allActiveResult.success || !allActiveResult.data) {
        return { success: false, cleaned: 0, error: allActiveResult.error };
      }

      const activeRecords = allActiveResult.data;
      const duplicates = this.analyzeDuplicates(activeRecords);
      const duplicateIds = Object.keys(duplicates);

      if (duplicateIds.length === 0) {
        console.log(`${modelName} - No duplicates found, cleanup not needed`);
        return { success: true, cleaned: 0 };
      }

      console.log(`${modelName} - Found ${duplicateIds.length} IDs with duplicates:`, duplicates);
      
      let totalCleaned = 0;

      for (const duplicateId of duplicateIds) {
        const duplicateInfo = duplicates[duplicateId];
        console.log(`${modelName} - Cleaning up ID: ${duplicateId}, versions: ${duplicateInfo.versions.join(', ')}`);

        // Get all active versions for this ID
        const activeVersions = activeRecords.filter((record: any) => record.id === duplicateId);

        if (activeVersions.length <= 1) {
          console.log(`${modelName} - ID ${duplicateId} already has only one active version`);
          continue;
        }

        // Sort by version timestamp and keep only the latest
        const sortedActive = activeVersions.sort((a: any, b: any) => 
          new Date(b.version).getTime() - new Date(a.version).getTime()
        );

        const latestVersion = sortedActive[0];
        const versionsToDeactivate = sortedActive.slice(1);

        console.log(`${modelName} - Keeping latest version: ${latestVersion.version}, deactivating ${versionsToDeactivate.length} older versions`);

        // Deactivate older versions by removing the 'active' attribute
        for (const versionToDeactivate of versionsToDeactivate) {
          try {
            await this.removeActiveAttribute(modelName, versionToDeactivate.id, versionToDeactivate.version);
            totalCleaned++;
            console.log(`${modelName} - Deactivated version: ${versionToDeactivate.version} for ID: ${duplicateId}`);
          } catch (error) {
            console.error(`${modelName} - Failed to deactivate version ${versionToDeactivate.version} for ID ${duplicateId}:`, error);
          }
        }
      }

      console.log(`🧹 Manual cleanup completed for ${modelName}. Cleaned ${totalCleaned} duplicate records.`);
      return { success: true, cleaned: totalCleaned };

    } catch (error: any) {
      console.error(`❌ Error during manual cleanup for ${modelName}:`, error);
      return { success: false, cleaned: 0, error: error.message };
    }
  }

  private async removeActiveAttribute(modelName: string, id: string, version: string): Promise<void> {
    const client = generateClient<Schema>();
    
    switch (modelName) {
      case 'Project':
        await client.models.Project.update({
          id,
          version,
          // Remove active by not including it in the update
          updatedAt: new Date().toISOString()
        });
        break;
      case 'Document':
        await client.models.Document.update({
          id,
          version,
          updatedAt: new Date().toISOString()
        });
        break;
      case 'User':
        await client.models.User.update({
          id,
          version,
          updatedAt: new Date().toISOString()
        });
        break;
      case 'DocumentType':
        await client.models.DocumentType.update({
          id,
          version,
          updatedAt: new Date().toISOString()
        });
        break;
      case 'Workflow':
        await client.models.Workflow.update({
          id,
          version,
          updatedAt: new Date().toISOString()
        });
        break;
      // Add other models as needed
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }
  }
}