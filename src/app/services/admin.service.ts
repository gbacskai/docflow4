import { Injectable, inject } from '@angular/core';
import { post, get, del } from 'aws-amplify/api';
import { AuthService } from './auth.service';

export interface DatabaseExport {
  id: string;
  fileName: string;
  size: number;
  lastModified: string;
  userId: string;
  exportType: 'user' | 'project' | 'full';
  recordCount?: number;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface ExportRequest {
  exportType: 'user' | 'project' | 'full';
  projectId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private authService = inject(AuthService);

  /**
   * Trigger a database export
   */
  async triggerExport(request: ExportRequest): Promise<{ success: boolean; export?: DatabaseExport; error?: string }> {
    try {
      const userId = this.authService.getUserId();
      
      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }

      const response = await post({
        apiName: 'api', // Replace with your API name
        path: '/db-export',
        options: {
          body: JSON.stringify({
            userId,
            exportType: request.exportType,
            projectId: request.projectId
          })
        }
      });

      const responseData = await response.response;
      const result = await responseData.body.json() as any;
      
      if (result.success) {
        return {
          success: true,
          export: result.export
        };
      } else {
        return {
          success: false,
          error: result.error || 'Export failed'
        };
      }
    } catch (error) {
      console.error('Failed to trigger export:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * List all database exports
   */
  async listExports(isAdmin: boolean = false): Promise<{ success: boolean; exports?: DatabaseExport[]; error?: string }> {
    try {
      const userId = this.authService.getUserId();
      
      if (!userId && !isAdmin) {
        return { success: false, error: 'User not authenticated' };
      }

      const queryParams: any = {};
      if (isAdmin) {
        queryParams.isAdmin = 'true';
      } else {
        queryParams.userId = userId;
      }

      const response = await get({
        apiName: 'api', // Replace with your API name
        path: '/list-exports',
        options: {
          queryParams
        }
      });

      const responseData = await response.response;
      const result = await responseData.body.json() as any;
      
      if (result.success) {
        return {
          success: true,
          exports: result.exports || []
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to list exports'
        };
      }
    } catch (error) {
      console.error('Failed to list exports:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate download URL for an export
   */
  async getDownloadUrl(exportId: string, fileName: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const userId = this.authService.getUserId();
      
      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }

      // This would typically generate a presigned URL
      // For now, we'll use the S3 object key structure
      const s3Key = `exports/${userId}/${exportId}/${fileName}`;
      
      // In a real implementation, you'd call a Lambda function to generate a presigned URL
      // For now, return the S3 key which can be used by the frontend
      return {
        success: true,
        url: s3Key
      };
    } catch (error) {
      console.error('Failed to generate download URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Import database from uploaded file
   */
  async importDatabase(file: File): Promise<{ success: boolean; imported?: any; error?: string }> {
    try {
      const userId = this.authService.getUserId();
      
      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }

      // Read file content
      const fileContent = await this.readFileAsText(file);
      let importData: any;

      try {
        importData = JSON.parse(fileContent);
      } catch (parseError) {
        return { success: false, error: 'Invalid JSON file format' };
      }

      // Validate import data structure
      if (!importData.metadata || !importData.data) {
        return { success: false, error: 'Invalid export file format' };
      }

      // Call import API
      const response = await post({
        apiName: 'api', // Replace with your API name
        path: '/db-import',
        options: {
          body: JSON.stringify({
            userId,
            importData
          })
        }
      });

      const responseData = await response.response;
      const result = await responseData.body.json() as any;
      
      if (result.success) {
        return {
          success: true,
          imported: result.imported
        };
      } else {
        return {
          success: false,
          error: result.error || 'Import failed'
        };
      }
    } catch (error) {
      console.error('Failed to import database:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /**
   * Delete an export
   */
  async deleteExport(exportId: string, fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const userId = this.authService.getUserId();
      
      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }

      const response = await del({
        apiName: 'api', // Replace with your API name
        path: `/db-export/${exportId}`,
        options: {
          queryParams: {
            userId,
            fileName
          }
        }
      });

      const responseData = await response.response;
      const result = await responseData.body.json() as any;
      
      if (result.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to delete export'
        };
      }
    } catch (error) {
      console.error('Failed to delete export:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}