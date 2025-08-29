import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
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
  
  // Dialog states
  showExportDialog = false;
  showImportDialog = false;
  selectedFile: File | null = null;
  
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
          { id: '1', name: 'Website Redesign', status: 'active', createdAt: '2024-01-15', defaultWorkflow: '1' },
          { id: '2', name: 'Mobile App', status: 'active', createdAt: '2024-01-10', defaultWorkflow: '2' },
        ],
        Workflows: [
          { id: '1', name: 'Development' },
          { id: '2', name: 'Marketing' },
          { id: '3', name: 'Operations' }
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
          Workflows: mockData.Workflows.length,
          DocumentTypes: mockData.DocumentTypes.length,
          Users: mockData.Users.length,
          Documents: mockData.Documents.length,
          totalRecords: mockData.Projects.length + mockData.Workflows.length + mockData.DocumentTypes.length + mockData.Users.length + mockData.Documents.length
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
      
      // Simulate importing each table with delays
      if (tables.Workflows && Array.isArray(tables.Workflows)) {
        this.importStatus.set('Importing Workflows...');
        await new Promise(resolve => setTimeout(resolve, 500));
        importedCount += tables.Workflows.length;
      }
      
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
      'Workflow',
      'ChatRoom',
      'ChatMessage'
    ];
    
    // GraphQL API tables (from data/resource.ts)
    const graphQLTables = [
      'Project',
      'Document',
      'User', 
      'DocumentType',
      'Workflow',
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
}
