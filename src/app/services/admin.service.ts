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
   * Initialize sample data using direct GraphQL mutation
   */
  async initializeSampleData(): Promise<{ success: boolean; results?: any; message?: string; error?: string }> {
    try {
      const client = generateClient<Schema>();
      
      // Create sample document types directly
      const documentTypes = [
        {
          name: 'Building Permit Application',
          identifier: 'BuildingPermit',
          definition: 'Application for building permits including architectural plans, engineering reports, and zoning compliance documentation',
          category: 'Construction',
          fields: ['property_address', 'project_description', 'architect_details', 'contractor_license', 'estimated_cost'],
          isActive: true,
          usageCount: 0,
        },
        {
          name: 'Environmental Impact Assessment',
          identifier: 'environmental_assessment',
          definition: 'Comprehensive environmental impact evaluation for development projects',
          category: 'Environment',
          fields: ['project_location', 'environmental_factors', 'mitigation_measures', 'compliance_certificates'],
          isActive: true,
          usageCount: 0,
        },
        {
          name: 'Business License Application',
          identifier: 'business_license',
          definition: 'Application for new business license including registration documents and compliance certificates',
          category: 'Business',
          fields: ['business_name', 'business_type', 'owner_details', 'location_address', 'tax_id'],
          isActive: true,
          usageCount: 0,
        },
        {
          name: 'Health Department Permit',
          identifier: 'health_permit',
          definition: 'Health department permits for food service establishments and healthcare facilities',
          category: 'Health',
          fields: ['facility_type', 'health_inspection', 'staff_certifications', 'equipment_list'],
          isActive: true,
          usageCount: 0,
        }
      ];

      const results = {
        documentTypes: { created: 0, skipped: 0, errors: [] as string[] }
      };

      // Create document types
      for (const docType of documentTypes) {
        try {
          await client.models.DocumentType.create({
            ...docType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          results.documentTypes.created++;
        } catch (error: any) {
          results.documentTypes.errors.push(`${docType.name}: ${error.message || 'Unknown error'}`);
        }
      }


      return {
        success: true,
        results,
        message: 'Sample data initialization completed'
      };

    } catch (error: any) {
      console.error('Sample data initialization error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        message: 'Failed to initialize sample data'
      };
    }
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
      const [users, documentTypes, projects] = await Promise.all([
        client.models.User.list(),
        client.models.DocumentType.list(),
        client.models.Project.list()
      ]);

      const stats = {
        userCount: users.data.length,
        activeUsers: users.data.filter(u => u.status === 'active').length,
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