import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { AuthService } from './auth.service';
import { VersionedDataService } from './versioned-data.service';

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
  private versionedDataService = inject(VersionedDataService);

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
   * Import database from uploaded file - direct GraphQL implementation
   */
  async importDatabase(file: File, conflictResolution: 'ignore' | 'update' = 'ignore'): Promise<{ success: boolean; imported?: any; error?: string }> {
    try {
      // Read the file
      const fileContent = await this.readFileAsText(file);
      const importData = JSON.parse(fileContent);
      
      // Validate import data structure
      if (!importData.tables || !importData.version) {
        throw new Error('Invalid import file format');
      }
      
      const client = generateClient<Schema>();
      const results = {
        documentTypes: { created: 0, skipped: 0, errors: [] as string[] },
        workflows: { created: 0, skipped: 0, errors: [] as string[] },
        projects: { created: 0, skipped: 0, errors: [] as string[] },
        documents: { created: 0, skipped: 0, errors: [] as string[] }
      };

      // Import DocumentTypes
      if (importData.tables.DocumentTypes) {
        for (const docType of importData.tables.DocumentTypes) {
          try {
            // Only include valid fields that exist in the current schema
            const documentTypeData: any = {};
            
            if (docType.name) documentTypeData.name = docType.name;
            if (docType.identifier) documentTypeData.identifier = docType.identifier;
            if (docType.definition) documentTypeData.definition = docType.definition;
            if (docType.validationRules) documentTypeData.validationRules = docType.validationRules;
            if (docType.category) documentTypeData.category = docType.category;
            if (docType.fields) documentTypeData.fields = docType.fields;
            if (docType.isActive !== undefined) documentTypeData.isActive = docType.isActive;
            if (docType.usageCount !== undefined) documentTypeData.usageCount = docType.usageCount;
            if (docType.templateCount !== undefined) documentTypeData.templateCount = docType.templateCount;
            
            const result = await this.versionedDataService.createVersionedRecord('DocumentType', {
              id: docType.id,
              data: documentTypeData
            });
            
            if (result.success) {
              results.documentTypes.created++;
            } else {
              results.documentTypes.errors.push(`${docType.name}: ${result.error}`);
            }
          } catch (error: any) {
            results.documentTypes.errors.push(`${docType.name}: ${error.message}`);
          }
        }
      }

      // Import Workflows
      if (importData.tables.Workflows) {
        for (const workflow of importData.tables.Workflows) {
          try {
            // Only include valid fields that exist in the current schema
            const workflowData: any = {};
            
            if (workflow.name) workflowData.name = workflow.name;
            if (workflow.identifier) workflowData.identifier = workflow.identifier;
            if (workflow.description) workflowData.description = workflow.description;
            if (workflow.rules) workflowData.rules = workflow.rules;
            if (workflow.actors) workflowData.actors = workflow.actors;
            if (workflow.isActive !== undefined) workflowData.isActive = workflow.isActive;
            
            const result = await this.versionedDataService.createVersionedRecord('Workflow', {
              id: workflow.id,
              data: workflowData
            });
            
            if (result.success) {
              results.workflows.created++;
            } else {
              results.workflows.errors.push(`${workflow.name}: ${result.error}`);
            }
          } catch (error: any) {
            results.workflows.errors.push(`${workflow.name}: ${error.message}`);
          }
        }
      }

      // Import Projects
      if (importData.tables.Projects) {
        for (const project of importData.tables.Projects) {
          try {
            // Only include valid fields that exist in the current schema
            const projectData: any = {};
            
            if (project.name) projectData.name = project.name;
            if (project.identifier) projectData.identifier = project.identifier;
            if (project.description) projectData.description = project.description;
            if (project.status) projectData.status = project.status;
            if (project.ownerId) projectData.ownerId = project.ownerId;
            if (project.adminUsers) projectData.adminUsers = project.adminUsers;
            if (project.workflowId) projectData.workflowId = project.workflowId;
            
            const result = await this.versionedDataService.createVersionedRecord('Project', {
              id: project.id,
              data: projectData
            });
            
            if (result.success) {
              results.projects.created++;
            } else {
              results.projects.errors.push(`${project.name}: ${result.error}`);
            }
          } catch (error: any) {
            results.projects.errors.push(`${project.name}: ${error.message}`);
          }
        }
      }

      // Import Documents
      if (importData.tables.Documents) {
        for (const document of importData.tables.Documents) {
          try {
            // Only include valid fields that exist in the current schema
            const documentData: any = {};
            
            if (document.projectId) documentData.projectId = document.projectId;
            if (document.documentType) documentData.documentType = document.documentType;
            if (document.formData) documentData.formData = document.formData;
            
            const result = await this.versionedDataService.createVersionedRecord('Document', {
              id: document.id,
              data: documentData
            });
            
            if (result.success) {
              results.documents.created++;
            } else {
              results.documents.errors.push(`${document.name || document.id}: ${result.error}`);
            }
          } catch (error: any) {
            results.documents.errors.push(`${document.name || document.id}: ${error.message}`);
          }
        }
      }

      return {
        success: true,
        imported: results
      };

    } catch (error: any) {
      console.error('Database import error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred during import'
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
          const result = await this.versionedDataService.createVersionedRecord('DocumentType', {
            data: {
              ...docType,
            }
          });
          
          if (result.success) {
            results.documentTypes.created++;
          } else {
            results.documentTypes.errors.push(`${docType.name}: ${result.error}`);
          }
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
   * Delete all Cognito users from the user pool
   * WARNING: This will delete ALL user accounts including admins
   */
  async deleteAllCognitoUsers(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    // TODO: Re-implement when Lambda function is enabled
    console.warn('deleteAllCognitoUsers is temporarily disabled');
    return {
      success: false,
      error: 'Cognito user deletion is temporarily disabled - Lambda function not deployed'
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

      // Get latest versions of all entities
      const [users, documentTypes, projects] = await Promise.all([
        this.versionedDataService.getAllLatestVersions('User'),
        this.versionedDataService.getAllLatestVersions('DocumentType'),
        this.versionedDataService.getAllLatestVersions('Project')
      ]);

      const userData = users.success ? users.data || [] : [];
      const documentTypeData = documentTypes.success ? documentTypes.data || [] : [];
      const projectData = projects.success ? projects.data || [] : [];

      const stats = {
        userCount: userData.length,
        activeUsers: userData.filter(u => u.status === 'active').length,
        documentTypeCount: documentTypeData.length,
        activeDocumentTypes: documentTypeData.filter(dt => dt.isActive).length,
        projectCount: projectData.length,
        activeProjects: projectData.filter(p => p.status === 'active').length
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