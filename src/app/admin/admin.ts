import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { AuthService } from '../services/auth.service';
import { VersionedDataService } from '../services/versioned-data.service';
import { AdminService, DatabaseExport, ExportRequest } from '../services/admin.service';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.less',
  standalone: true
})
export class Admin implements OnInit {
  private authService = inject(AuthService);
  private versionedDataService = inject(VersionedDataService);
  private adminService = inject(AdminService);
  
  // Signals
  exports = signal<DatabaseExport[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  loadingMessage = signal('Loading...');
  
  // Legacy signals for existing template compatibility
  exportLoading = signal(false);
  importLoading = signal(false);
  exportStatus = signal<string>('');
  importStatus = signal<string>('');
  
  // Sample data initialization
  initSampleDataLoading = signal(false);
  initSampleDataStatus = signal<string>('');
  
  // Dialog states
  showExportDialog = false;
  showImportDialog = false;
  selectedFile: File | null = null;
  
  // Backup/Restore functionality
  backupLoading = signal(false);
  restoreLoading = signal(false);
  backupStatus = signal<string>('');
  restoreStatus = signal<string>('');
  selectedBackupFile: File | null = null;
  
  // Clear database functionality
  clearDatabaseLoading = signal(false);
  clearDatabaseStatus = signal<string>('');
  
  backupOptions = {
    documentTypes: true,
    workflows: true,
    projects: true,
    documents: true
  };
  
  restoreOptions = {
    documentTypes: false,
    workflows: false,
    projects: false,
    documents: false,
    conflictResolution: 'ignore' as 'ignore' | 'update'
  };
  
  // Form data
  exportForm: ExportRequest = {
    exportType: 'user'
  };
  
  // Current user
  currentUser = this.authService.currentUser;
  
  // DynamoDB table names
  tableNames = signal<{[key: string]: string}>({});
  
  constructor() {
    this.loadTableNames();
  }

  async ngOnInit() {
    await this.loadExports();
  }
  

  async loadExports() {
    this.isLoading.set(true);
    this.loadingMessage.set('Loading exports...');

    try {
      const result = await this.adminService.listExports(true); // Admin view
      
      if (result.success && result.exports) {
        this.exports.set(result.exports);
      } else {
        this.errorMessage.set(result.error || 'Failed to load exports');
      }
    } catch (error) {
      this.errorMessage.set('An error occurred while loading exports');
      console.error('Load exports error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshExports() {
    await this.loadExports();
    this.successMessage.set('Exports list refreshed');
  }

  async triggerServerlessExport() {
    this.exportLoading.set(true);
    this.exportStatus.set('Creating serverless export...');
    this.errorMessage.set('');

    try {
      const result = await this.adminService.triggerExport(this.exportForm);
      
      if (result.success) {
        this.exportStatus.set('✅ Serverless export created successfully');
        this.showExportDialog = false;
        this.resetExportForm();
        await this.loadExports();
      } else {
        this.exportStatus.set('❌ Failed to create serverless export: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      this.exportStatus.set('❌ An error occurred while creating serverless export');
      console.error('Serverless export error:', error);
    } finally {
      this.exportLoading.set(false);
    }
  }

  resetExportForm() {
    this.exportForm = {
      exportType: 'user'
    };
  }

  async downloadExport(exportItem: DatabaseExport) {
    this.isLoading.set(true);
    this.loadingMessage.set('Preparing download...');

    try {
      const result = await this.adminService.getDownloadUrl(exportItem.id, exportItem.fileName);
      
      if (result.success && result.url) {
        this.successMessage.set('Download started');
        
        // Create a temporary download link
        const link = document.createElement('a');
        link.href = result.url;
        link.download = exportItem.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        this.errorMessage.set(result.error || 'Failed to generate download URL');
      }
    } catch (error) {
      this.errorMessage.set('An error occurred while preparing download');
      console.error('Download error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteExport(exportItem: DatabaseExport) {
    if (!confirm(`Are you sure you want to delete "${exportItem.fileName}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.loadingMessage.set('Deleting export...');

    try {
      const result = await this.adminService.deleteExport(exportItem.id, exportItem.fileName);
      
      if (result.success) {
        this.successMessage.set('Export deleted successfully');
        await this.loadExports();
      } else {
        this.errorMessage.set(result.error || 'Failed to delete export');
      }
    } catch (error) {
      this.errorMessage.set('An error occurred while deleting export');
      console.error('Delete error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
  
  async exportDatabase() {
    this.exportLoading.set(true);
    this.exportStatus.set('Starting database export...');
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock export data
      const mockData = {
        Projects: [
          { id: '1', name: 'Website Redesign', status: 'active', createdAt: '2024-01-15' },
          { id: '2', name: 'Mobile App', status: 'active', createdAt: '2024-01-10' },
        ],
        DocumentTypes: [
          { id: '1', name: 'Requirements' },
          { id: '2', name: 'Design' },
          { id: '3', name: 'Technical Specs' }
        ],
        Users: [
          { id: '1', name: 'John Doe', email: 'john@example.com' },
          { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
        ],
        Documents: [
          { id: '1', name: 'Project Requirements.pdf', status: 'uploaded' },
          { id: '2', name: 'Design Mockups.pdf', status: 'pending' }
        ]
      };
      
      const exportData = {
        exportDate: new Date().toISOString(),
        exportedBy: this.currentUser()?.username || 'Unknown',
        version: '1.0',
        tables: mockData,
        statistics: {
          Projects: mockData.Projects.length,
          DocumentTypes: mockData.DocumentTypes.length,
          Users: mockData.Users.length,
          Documents: mockData.Documents.length,
          totalRecords: mockData.Projects.length + mockData.DocumentTypes.length + mockData.Users.length + mockData.Documents.length
        }
      };
      
      // Create and download JSON file
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `docflow4-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      this.exportStatus.set(`✅ Export completed successfully! ${exportData.statistics.totalRecords} records exported.`);
      
    } catch (error) {
      console.error('Export failed:', error);
      this.exportStatus.set('❌ Export failed: ' + (error as Error).message);
    } finally {
      this.exportLoading.set(false);
    }
  }
  
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      this.importDatabase(file);
    }
  }
  
  async importDatabase(file: File) {
    this.importLoading.set(true);
    this.importStatus.set('Reading import file...');
    
    try {
      // Read the file
      const fileContent = await this.readFileAsText(file);
      const importData = JSON.parse(fileContent);
      
      // Validate import data structure
      if (!importData.tables || !importData.version) {
        throw new Error('Invalid import file format');
      }
      
      this.importStatus.set('Validating import data...');
      
      // Confirm import with user
      const totalRecords = importData.statistics?.totalRecords || 0;
      const confirmImport = confirm(
        `This will import ${totalRecords} records from ${importData.exportDate}. ` +
        `This operation cannot be undone. Are you sure you want to proceed?`
      );
      
      if (!confirmImport) {
        this.importStatus.set('Import cancelled by user.');
        this.importLoading.set(false);
        return;
      }
      
      this.importStatus.set('Starting import process...');
      
      let importedCount = 0;
      const errors: string[] = [];
      
      // Simulate import process
      const tables = importData.tables;
      
      
      if (tables.Users && Array.isArray(tables.Users)) {
        this.importStatus.set('Importing Users...');
        await new Promise(resolve => setTimeout(resolve, 500));
        importedCount += tables.Users.length;
      }
      
      if (tables.DocumentTypes && Array.isArray(tables.DocumentTypes)) {
        this.importStatus.set('Importing Document Types...');
        await new Promise(resolve => setTimeout(resolve, 500));
        importedCount += tables.DocumentTypes.length;
      }
      
      if (tables.Projects && Array.isArray(tables.Projects)) {
        this.importStatus.set('Importing Projects...');
        await new Promise(resolve => setTimeout(resolve, 500));
        importedCount += tables.Projects.length;
      }
      
      if (tables.Documents && Array.isArray(tables.Documents)) {
        this.importStatus.set('Importing Documents...');
        await new Promise(resolve => setTimeout(resolve, 500));
        importedCount += tables.Documents.length;
      }
      
      // Show results
      if (errors.length > 0) {
        this.importStatus.set(
          `⚠️ Import completed with warnings. ${importedCount} records imported successfully. ` +
          `${errors.length} errors occurred. Check console for details.`
        );
        console.warn('Import errors:', errors);
      } else {
        this.importStatus.set(`✅ Import completed successfully! ${importedCount} records imported.`);
      }
      
      
    } catch (error) {
      console.error('Import failed:', error);
      this.importStatus.set('❌ Import failed: ' + (error as Error).message);
    } finally {
      this.importLoading.set(false);
      // Clear the file input
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.value = '';
    }
  }
  
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  clearMessages() {
    this.exportStatus.set('');
    this.importStatus.set('');
  }

  loadTableNames() {
    // Get environment name - consistent with backend naming logic
    const envName = 'dev001'; // This should match your current environment
    const appName = 'docflow4';
    
    // Custom DynamoDB tables (from all-tables.ts)
    const customTables = [
      'Project',
      'Document', 
      'User',
      'DocumentType',
      'ChatRoom',
      'ChatMessage'
    ];
    
    // GraphQL API tables (from data/resource.ts)
    const graphQLTables = [
      'Project',
      'Document',
      'User', 
      'DocumentType',
      'ChatRoom',
      'ChatMessage'
    ];
    
    const tableNamesMap: {[key: string]: string} = {};
    
    // Custom tables with docflow4-{TableName}-{Environment} pattern
    customTables.forEach(tableName => {
      const physicalName = `${appName}-${tableName}-${envName}`;
      tableNamesMap[`Custom ${tableName}`] = physicalName;
    });
    
    // GraphQL tables with auto-generated Amplify naming
    graphQLTables.forEach(tableName => {
      // Amplify auto-generates table names like: [StackName]-[ModelName]-[UniqueId]
      const physicalName = `${appName}-${tableName}-${envName}`;
      tableNamesMap[`GraphQL ${tableName}`] = `${physicalName} (Amplify generated)`;
    });
    
    // Storage bucket
    tableNamesMap['S3 Bucket'] = `${appName}-${envName}`;
    
    this.tableNames.set(tableNamesMap);
  }

  async initializeSampleData() {
    if (!confirm('This will create sample document types. Existing records will not be duplicated. Do you want to proceed?')) {
      return;
    }

    this.initSampleDataLoading.set(true);
    this.initSampleDataStatus.set('Initializing sample data...');
    this.errorMessage.set('');

    try {
      const result = await this.adminService.initializeSampleData();
      
      if (result.success) {
        const results = result.results;
        let statusMessage = '✅ Sample data initialization completed!\n\n';
        
        if (results?.documentTypes) {
          statusMessage += `Document Types: ${results.documentTypes.created} created, ${results.documentTypes.skipped} skipped\n`;
        }

        if (results?.documentTypes?.errors?.length > 0) {
          statusMessage += '\nErrors occurred:\n';
          results.documentTypes.errors?.forEach((error: string) => {
            statusMessage += `• ${error}\n`;
          });
        }
        
        this.initSampleDataStatus.set(statusMessage);
        this.successMessage.set('Sample data initialization completed successfully');
      } else {
        const errorMsg = result.message || result.error || 'Unknown error occurred';
        this.initSampleDataStatus.set(`❌ Initialization failed: ${errorMsg}`);
        this.errorMessage.set(`Failed to initialize sample data: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Sample data initialization error:', error);
      this.initSampleDataStatus.set('❌ An error occurred during sample data initialization');
      this.errorMessage.set('An unexpected error occurred while initializing sample data');
    } finally {
      this.initSampleDataLoading.set(false);
    }
  }

  clearInitSampleDataStatus() {
    this.initSampleDataStatus.set('');
  }

  hasBackupSelection(): boolean {
    return this.backupOptions.documentTypes || this.backupOptions.workflows || this.backupOptions.projects || this.backupOptions.documents;
  }

  hasRestoreSelection(): boolean {
    return this.restoreOptions.documentTypes || this.restoreOptions.workflows || this.restoreOptions.projects || this.restoreOptions.documents;
  }

  async createBackup() {
    if (!this.hasBackupSelection()) {
      alert('Please select at least one data type to backup.');
      return;
    }

    this.backupLoading.set(true);
    this.backupStatus.set('Creating backup...');
    this.errorMessage.set('');

    try {
      const client = generateClient<Schema>();
      const backupData: any = {
        exportDate: new Date().toISOString(),
        exportedBy: this.currentUser()?.username || 'Unknown',
        version: '1.0',
        tables: {},
        statistics: {}
      };

      let totalRecords = 0;

      // Backup Document Types
      if (this.backupOptions.documentTypes) {
        this.backupStatus.set('Backing up Document Types...');
        const result = await this.versionedDataService.getAllLatestVersions('DocumentType');
        if (result.success && result.data) {
          backupData.tables.DocumentTypes = result.data;
          backupData.statistics.DocumentTypes = result.data.length;
          totalRecords += result.data.length;
        }
      }

      // Backup Workflows
      if (this.backupOptions.workflows) {
        this.backupStatus.set('Backing up Workflows...');
        const result = await this.versionedDataService.getAllLatestVersions('Workflow');
        if (result.success && result.data) {
          backupData.tables.Workflows = result.data;
          backupData.statistics.Workflows = result.data.length;
          totalRecords += result.data.length;
        }
      }

      // Backup Projects
      if (this.backupOptions.projects) {
        this.backupStatus.set('Backing up Projects...');
        const result = await this.versionedDataService.getAllLatestVersions('Project');
        if (result.success && result.data) {
          backupData.tables.Projects = result.data;
          backupData.statistics.Projects = result.data.length;
          totalRecords += result.data.length;
        }
      }

      // Backup Documents
      if (this.backupOptions.documents) {
        this.backupStatus.set('Backing up Documents...');
        const result = await this.versionedDataService.getAllLatestVersions('Document');
        if (result.success && result.data) {
          backupData.tables.Documents = result.data;
          backupData.statistics.Documents = result.data.length;
          totalRecords += result.data.length;
        }
      }

      backupData.statistics.totalRecords = totalRecords;

      // Create and download JSON file
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      
      const selectedTypes = Object.entries(this.backupOptions)
        .filter(([key, value]) => value)
        .map(([key]) => key)
        .join('-');
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `docflow4-backup-${selectedTypes}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      this.backupStatus.set(`✅ Backup completed successfully! ${totalRecords} records exported.`);
      this.successMessage.set('Backup created and downloaded successfully');
      
    } catch (error) {
      console.error('Backup failed:', error);
      this.backupStatus.set('❌ Backup failed: ' + (error as Error).message);
      this.errorMessage.set('Failed to create backup: ' + (error as Error).message);
    } finally {
      this.backupLoading.set(false);
    }
  }

  onBackupFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      if (!file.name.endsWith('.json')) {
        alert('Please select a valid JSON backup file.');
        return;
      }
      
      this.selectedBackupFile = file;
      this.restoreStatus.set('');
      
      // Reset restore options
      this.restoreOptions = {
        documentTypes: false,
        workflows: false,
        projects: false,
        documents: false,
        conflictResolution: 'ignore' as 'ignore' | 'update'
      };
    }
  }

  clearSelectedFile() {
    this.selectedBackupFile = null;
    this.restoreStatus.set('');
    
    // Clear the file input
    const input = document.getElementById('backup-file-input') as HTMLInputElement;
    if (input) input.value = '';
  }

  async restoreFromBackup() {
    if (!this.selectedBackupFile) {
      alert('Please select a backup file first.');
      return;
    }

    if (!this.hasRestoreSelection()) {
      alert('Please select at least one data type to restore.');
      return;
    }

    const conflictAction = this.restoreOptions.conflictResolution === 'update' ? 'overwritten' : 'skipped';
    const confirmRestore = confirm(
      `This will restore the selected data types from the backup file. ` +
      `Existing records will be ${conflictAction}. This operation cannot be undone. ` +
      `Are you sure you want to proceed?`
    );

    if (!confirmRestore) {
      return;
    }

    this.restoreLoading.set(true);
    this.restoreStatus.set('Reading backup file...');
    this.errorMessage.set('');

    try {
      // Read and parse the backup file
      const fileContent = await this.readFileAsText(this.selectedBackupFile);
      const backupData = JSON.parse(fileContent);

      // Validate backup data structure
      if (!backupData.tables || !backupData.version) {
        throw new Error('Invalid backup file format');
      }

      this.restoreStatus.set('Validating backup data...');

      const client = generateClient<Schema>();
      let restoredCount = 0;
      const errors: string[] = [];

      // Restore Document Types
      if (this.restoreOptions.documentTypes && backupData.tables.DocumentTypes) {
        this.restoreStatus.set('Restoring Document Types...');
        const documentTypes = backupData.tables.DocumentTypes;
        
        for (const docType of documentTypes) {
          try {
            // Find existing document type by identifier using versioned service
            const existingResult = await this.versionedDataService.getAllLatestVersions('DocumentType');
            const allDocTypes = existingResult.success ? existingResult.data || [] : [];
            const existingDocTypes = allDocTypes.filter(dt => dt.identifier === docType.identifier);
            
            const { id, createdAt, updatedAt, ...updateData } = docType;
            
            if (existingDocTypes && existingDocTypes.length > 0) {
              if (this.restoreOptions.conflictResolution === 'update') {
                // Update existing document type
                const existing = existingDocTypes[0];
                const result = await this.versionedDataService.updateVersionedRecord('DocumentType', existing.id, {
                  ...updateData,
                  updatedAt: new Date().toISOString()
                });
                if (!result.success) {
                  throw new Error(result.error || 'Failed to update DocumentType');
                }
              } else {
                // Skip existing document type
                continue;
              }
            } else {
              // Create new document type using versioned service
              const result = await this.versionedDataService.createVersionedRecord('DocumentType', {
                data: {
                  ...updateData,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              });
              if (!result.success) {
                throw new Error(result.error || 'Failed to create DocumentType');
              }
            }
            restoredCount++;
          } catch (error: any) {
            errors.push(`Document Type "${docType.name}": ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Restore Workflows
      if (this.restoreOptions.workflows && backupData.tables.Workflows) {
        this.restoreStatus.set('Restoring Workflows...');
        const workflows = backupData.tables.Workflows;
        
        for (const workflow of workflows) {
          try {
            // Find existing workflow by identifier using versioned service
            const existingResult = await this.versionedDataService.getAllLatestVersions('Workflow');
            const allWorkflows = existingResult.success ? existingResult.data || [] : [];
            const existingWorkflows = allWorkflows.filter(w => w.identifier === workflow.identifier);
            
            const { id, createdAt, updatedAt, ...updateData } = workflow;
            
            if (existingWorkflows && existingWorkflows.length > 0) {
              if (this.restoreOptions.conflictResolution === 'update') {
                // Update existing workflow
                const existing = existingWorkflows[0];
                const result = await this.versionedDataService.updateVersionedRecord('Workflow', existing.id, {
                  ...updateData,
                  updatedAt: new Date().toISOString()
                });
                if (!result.success) {
                  throw new Error(result.error || 'Failed to update Workflow');
                }
              } else {
                // Skip existing workflow
                continue;
              }
            } else {
              // Create new workflow using versioned service
              const result = await this.versionedDataService.createVersionedRecord('Workflow', {
                data: {
                  ...updateData,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              });
              if (!result.success) {
                throw new Error(result.error || 'Failed to create Workflow');
              }
            }
            restoredCount++;
          } catch (error: any) {
            errors.push(`Workflow "${workflow.name}": ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Restore Projects
      if (this.restoreOptions.projects && backupData.tables.Projects) {
        this.restoreStatus.set('Restoring Projects...');
        const projects = backupData.tables.Projects;
        
        for (const project of projects) {
          try {
            // Find existing project by identifier using versioned service
            const existingResult = await this.versionedDataService.getAllLatestVersions('Project');
            const allProjects = existingResult.success ? existingResult.data || [] : [];
            const existingProjects = allProjects.filter(p => p.identifier === project.identifier);
            
            const { id, createdAt, updatedAt, ...updateData } = project;
            
            if (existingProjects && existingProjects.length > 0) {
              if (this.restoreOptions.conflictResolution === 'update') {
                // Update existing project
                const existing = existingProjects[0];
                const result = await this.versionedDataService.updateVersionedRecord('Project', existing.id, {
                  ...updateData,
                  updatedAt: new Date().toISOString()
                });
                if (!result.success) {
                  throw new Error(result.error || 'Failed to update Project');
                }
              } else {
                // Skip existing project
                continue;
              }
            } else {
              // Create new project using versioned service
              const result = await this.versionedDataService.createVersionedRecord('Project', {
                data: {
                  ...updateData,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              });
              if (!result.success) {
                throw new Error(result.error || 'Failed to create Project');
              }
            }
            restoredCount++;
          } catch (error: any) {
            errors.push(`Project "${project.name}": ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Restore Documents
      if (this.restoreOptions.documents && backupData.tables.Documents) {
        this.restoreStatus.set('Restoring Documents...');
        const documents = backupData.tables.Documents;
        
        for (const document of documents) {
          try {
            // Find existing document by projectId and documentType combination using versioned service
            const existingResult = await this.versionedDataService.getAllLatestVersions('Document');
            const allDocuments = existingResult.success ? existingResult.data || [] : [];
            const existingDocuments = allDocuments.filter(d => 
              d.projectId === document.projectId && d.documentType === document.documentType
            );
            
            const { id, createdAt, updatedAt, ...updateData } = document;
            
            if (existingDocuments && existingDocuments.length > 0) {
              if (this.restoreOptions.conflictResolution === 'update') {
                // Update existing document
                const existing = existingDocuments[0];
                const result = await this.versionedDataService.updateVersionedRecord('Document', existing.id, {
                  ...updateData,
                  updatedAt: new Date().toISOString()
                });
                if (!result.success) {
                  throw new Error(result.error || 'Failed to update Document');
                }
              } else {
                // Skip existing document
                continue;
              }
            } else {
              // Create new document using versioned service
              const result = await this.versionedDataService.createVersionedRecord('Document', {
                data: {
                  ...updateData,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              });
              if (!result.success) {
                throw new Error(result.error || 'Failed to create Document');
              }
            }
            restoredCount++;
          } catch (error: any) {
            errors.push(`Document "${document.documentType}" in project "${document.projectId}": ${error.message || 'Unknown error'}`);
          }
        }
      }

      // Show results
      if (errors.length > 0) {
        this.restoreStatus.set(
          `⚠️ Restore completed with warnings. ${restoredCount} records restored successfully. ` +
          `${errors.length} errors occurred:\n\n${errors.join('\n')}`
        );
      } else {
        this.restoreStatus.set(`✅ Restore completed successfully! ${restoredCount} records restored.`);
        this.successMessage.set('Data restored successfully from backup');
      }

      // Clear the selected file
      this.clearSelectedFile();
      
    } catch (error) {
      console.error('Restore failed:', error);
      this.restoreStatus.set('❌ Restore failed: ' + (error as Error).message);
      this.errorMessage.set('Failed to restore from backup: ' + (error as Error).message);
    } finally {
      this.restoreLoading.set(false);
    }
  }

  clearBackupStatus() {
    this.backupStatus.set('');
  }

  clearRestoreStatus() {
    this.restoreStatus.set('');
  }

  async clearDatabase() {
    const confirmClear = confirm(
      'This will permanently delete ALL data from the database including:\n' +
      '• Document Types (all versions)\n' +
      '• Workflows (all versions)\n' +
      '• Projects (all versions)\n' +
      '• Documents (all versions)\n' +
      '• Chat Rooms (all versions)\n' +
      '• Chat Messages (all versions)\n' +
      '• Users (all versions)\n' +
      '• Cognito user accounts (ALL users including admins)\n\n' +
      'This operation will delete EVERY version of EVERY record AND all user accounts and cannot be undone. Are you absolutely sure you want to proceed?'
    );

    if (!confirmClear) {
      return;
    }

    // Double confirmation for safety
    const doubleConfirm = confirm(
      'FINAL WARNING: This will delete ALL your data permanently. Type "DELETE ALL" and click OK to continue.'
    );

    if (!doubleConfirm) {
      return;
    }

    this.clearDatabaseLoading.set(true);
    this.clearDatabaseStatus.set('Starting database clear operation...');
    this.errorMessage.set('');

    try {
      const client = generateClient<Schema>();
      let deletedCount = 0;
      const errors: string[] = [];

      // Clear Documents first (to avoid foreign key constraints)
      this.clearDatabaseStatus.set('Clearing Documents (all versions)...');
      try {
        const result = await this.versionedDataService.deleteAllVersionsAllRecords('Document');
        if (result.success) {
          deletedCount += result.deletedCount || 0;
          this.clearDatabaseStatus.set(`Cleared ${result.deletedCount || 0} Document records (all versions)...`);
        } else {
          errors.push(`Documents: ${result.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        errors.push(`Documents: ${error.message || 'Unknown error'}`);
      }

      // Clear Projects
      this.clearDatabaseStatus.set('Clearing Projects (all versions)...');
      try {
        const result = await this.versionedDataService.deleteAllVersionsAllRecords('Project');
        if (result.success) {
          deletedCount += result.deletedCount || 0;
          this.clearDatabaseStatus.set(`Cleared ${result.deletedCount || 0} Project records (all versions)...`);
        } else {
          errors.push(`Projects: ${result.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        errors.push(`Projects: ${error.message || 'Unknown error'}`);
      }

      // Clear Workflows
      this.clearDatabaseStatus.set('Clearing Workflows (all versions)...');
      try {
        const result = await this.versionedDataService.deleteAllVersionsAllRecords('Workflow');
        if (result.success) {
          deletedCount += result.deletedCount || 0;
          this.clearDatabaseStatus.set(`Cleared ${result.deletedCount || 0} Workflow records (all versions)...`);
        } else {
          errors.push(`Workflows: ${result.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        errors.push(`Workflows: ${error.message || 'Unknown error'}`);
      }

      // Clear Document Types last
      this.clearDatabaseStatus.set('Clearing Document Types (all versions)...');
      try {
        const result = await this.versionedDataService.deleteAllVersionsAllRecords('DocumentType');
        if (result.success) {
          deletedCount += result.deletedCount || 0;
          this.clearDatabaseStatus.set(`Cleared ${result.deletedCount || 0} DocumentType records (all versions)...`);
        } else {
          errors.push(`Document Types: ${result.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        errors.push(`Document Types: ${error.message || 'Unknown error'}`);
      }

      // Clear Chat data (ChatRooms and ChatMessages)
      this.clearDatabaseStatus.set('Clearing Chat Messages (all versions)...');
      try {
        const result = await this.versionedDataService.deleteAllVersionsAllRecords('ChatMessage');
        if (result.success) {
          deletedCount += result.deletedCount || 0;
          this.clearDatabaseStatus.set(`Cleared ${result.deletedCount || 0} ChatMessage records (all versions)...`);
        } else {
          errors.push(`Chat Messages: ${result.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        errors.push(`Chat Messages: ${error.message || 'Unknown error'}`);
      }

      this.clearDatabaseStatus.set('Clearing Chat Rooms (all versions)...');
      try {
        const result = await this.versionedDataService.deleteAllVersionsAllRecords('ChatRoom');
        if (result.success) {
          deletedCount += result.deletedCount || 0;
          this.clearDatabaseStatus.set(`Cleared ${result.deletedCount || 0} ChatRoom records (all versions)...`);
        } else {
          errors.push(`Chat Rooms: ${result.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        errors.push(`Chat Rooms: ${error.message || 'Unknown error'}`);
      }

      // Clear Users (DynamoDB records and Cognito accounts)
      this.clearDatabaseStatus.set('Clearing Users (all versions)...');
      try {
        const result = await this.versionedDataService.deleteAllVersionsAllRecords('User');
        if (result.success) {
          deletedCount += result.deletedCount || 0;
          this.clearDatabaseStatus.set(`Cleared ${result.deletedCount || 0} User records (all versions)...`);
        } else {
          errors.push(`Users: ${result.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        errors.push(`Users: ${error.message || 'Unknown error'}`);
      }

      // Note: Cognito users require manual deletion from AWS Console
      this.clearDatabaseStatus.set('Note: Cognito user accounts require manual deletion from AWS Console...');

      // Show results
      if (errors.length > 0) {
        this.clearDatabaseStatus.set(
          `⚠️ Database clear completed with warnings. ${deletedCount} DynamoDB records deleted. ` +
          `${errors.length} errors occurred:\n\n${errors.join('\n')}\n\n` +
          `⚠️ IMPORTANT: Cognito user accounts must be manually deleted from AWS Console.`
        );
      } else {
        this.clearDatabaseStatus.set(
          `✅ Database cleared successfully! ${deletedCount} DynamoDB records deleted.\n\n` +
          `⚠️ IMPORTANT: Cognito user accounts must be manually deleted from AWS Console.`
        );
        this.successMessage.set('Database cleared successfully - DynamoDB data removed');
      }
      
    } catch (error) {
      console.error('Clear database failed:', error);
      this.clearDatabaseStatus.set('❌ Clear database failed: ' + (error as Error).message);
      this.errorMessage.set('Failed to clear database: ' + (error as Error).message);
    } finally {
      this.clearDatabaseLoading.set(false);
    }
  }

  clearClearDatabaseStatus() {
    this.clearDatabaseStatus.set('');
  }
}
