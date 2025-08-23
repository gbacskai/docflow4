import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin',
  imports: [CommonModule],
  templateUrl: './admin.html',
  styleUrl: './admin.less',
  standalone: true
})
export class Admin {
  private authService = inject(AuthService);
  
  // Loading states
  exportLoading = signal(false);
  importLoading = signal(false);
  
  // Status messages
  exportStatus = signal<string>('');
  importStatus = signal<string>('');
  
  // Statistics
  exportStats = signal<{[key: string]: number}>({});
  
  // Current user
  currentUser = this.authService.currentUser;
  
  constructor() {
    this.loadExportStats();
  }
  
  async loadExportStats() {
    // Mock statistics for demonstration
    this.exportStats.set({
      Projects: 4,
      Domains: 3,
      DocumentTypes: 5,
      Users: 4,
      Documents: 12
    });
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
          { id: '1', name: 'Website Redesign', status: 'active', createdAt: '2024-01-15', defaultDomain: '1' },
          { id: '2', name: 'Mobile App', status: 'active', createdAt: '2024-01-10', defaultDomain: '2' },
        ],
        Domains: [
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
          Domains: mockData.Domains.length,
          DocumentTypes: mockData.DocumentTypes.length,
          Users: mockData.Users.length,
          Documents: mockData.Documents.length,
          totalRecords: mockData.Projects.length + mockData.Domains.length + mockData.DocumentTypes.length + mockData.Users.length + mockData.Documents.length
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
      if (tables.Domains && Array.isArray(tables.Domains)) {
        this.importStatus.set('Importing Domains...');
        await new Promise(resolve => setTimeout(resolve, 500));
        importedCount += tables.Domains.length;
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
      
      // Refresh stats
      await this.loadExportStats();
      
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
}
