import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

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
        updatedAt: version
      };

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
          success: false,
          error: 'Record not found'
        };
      }

      const latestRecord = records.sort((a: any, b: any) => 
        new Date(b.version).getTime() - new Date(a.version).getTime()
      )[0];

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
      let allRecords;
      switch (modelName) {
        case 'Project':
          allRecords = (await this.client.models.Project.list()).data;
          break;
        case 'Document':
          allRecords = (await this.client.models.Document.list()).data;
          break;
        case 'User':
          allRecords = (await this.client.models.User.list()).data;
          break;
        case 'DocumentType':
          allRecords = (await this.client.models.DocumentType.list()).data;
          break;
        case 'Workflow':
          allRecords = (await this.client.models.Workflow.list()).data;
          break;
        case 'ChatRoom':
          allRecords = (await this.client.models.ChatRoom.list()).data;
          break;
        case 'ChatMessage':
          allRecords = (await this.client.models.ChatMessage.list()).data;
          break;
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }

      if (!allRecords || allRecords.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      // Sort all records by version (sort key) in descending order to ensure latest first
      const sortedRecords = allRecords.sort((a: any, b: any) => {
        return new Date(b.version).getTime() - new Date(a.version).getTime();
      });

      // Group by ID and keep only the latest version (first record due to sort)
      const recordsById = sortedRecords.reduce((acc: any, record: any) => {
        if (!acc[record.id]) {
          acc[record.id] = record; // Keep first occurrence (which is latest due to sort)
        }
        return acc;
      }, {});

      const latestVersions = Object.values(recordsById);

      // Debug logging to verify latest versions are being returned
      console.log(`${modelName} - Total records: ${allRecords.length}, Latest versions: ${latestVersions.length}`);
      if (latestVersions.length > 0) {
        console.log(`${modelName} - Sample latest version:`, {
          id: (latestVersions[0] as any).id,
          version: (latestVersions[0] as any).version
        });
      }

      return {
        success: true,
        data: latestVersions
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
}