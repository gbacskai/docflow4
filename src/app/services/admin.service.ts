import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
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
   * Trigger a database export (placeholder - requires backend lambda functions)
   */
  async triggerExport(request: ExportRequest): Promise<{ success: boolean; export?: DatabaseExport; error?: string }> {
    return {
      success: false,
      error: 'Database export functionality requires backend API setup. Please configure lambda functions for export operations.'
    };
  }

  /**
   * List all database exports (placeholder - requires backend lambda functions)
   */
  async listExports(isAdmin: boolean = false): Promise<{ success: boolean; exports?: DatabaseExport[]; error?: string }> {
    return {
      success: true,
      exports: [] // Return empty array since no backend implementation exists
    };
  }

  /**
   * Generate download URL for an export (placeholder - requires backend lambda functions)
   */
  async getDownloadUrl(exportId: string, fileName: string): Promise<{ success: boolean; url?: string; error?: string }> {
    return {
      success: false,
      error: 'Download URL generation requires backend API setup. Please configure lambda functions for export operations.'
    };
  }

  /**
   * Import database from uploaded file (placeholder - requires backend lambda functions)
   */
  async importDatabase(file: File): Promise<{ success: boolean; imported?: any; error?: string }> {
    return {
      success: false,
      error: 'Database import functionality requires backend API setup. Please configure lambda functions for import operations.'
    };
  }

  /**
   * Delete an export (placeholder - requires backend lambda functions)
   */
  async deleteExport(exportId: string, fileName: string): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error: 'Delete export functionality requires backend API setup. Please configure lambda functions for export operations.'
    };
  }

  /**
   * Get system statistics for admin dashboard
   */
  async getSystemStats(): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
      const userId = this.authService.getUserId();
      
      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }

      const client = generateClient<Schema>();
      
      // Get counts of various entities
      const [users, domains, documentTypes, projects] = await Promise.all([
        client.models.User.list(),
        client.models.Domain.list(),
        client.models.DocumentType.list(),
        client.models.Project.list()
      ]);

      const stats = {
        userCount: users.data.length,
        activeUsers: users.data.filter(u => u.status === 'active').length,
        domainCount: domains.data.length,
        activeDomains: domains.data.filter(d => d.status === 'active').length,
        documentTypeCount: documentTypes.data.length,
        activeDocumentTypes: documentTypes.data.filter(dt => dt.isActive).length,
        projectCount: projects.data.length,
        activeProjects: projects.data.filter(p => p.status === 'active').length
      };

      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('Failed to get system stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load system statistics'
      };
    }
  }
}