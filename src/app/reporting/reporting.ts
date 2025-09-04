import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { DynamicFormService } from '../services/dynamic-form.service';
import { VersionedDataService } from '../services/versioned-data.service';
import { DynamicFormComponent } from '../shared/dynamic-form.component';

interface DocumentStatus {
  status: string;
  icon: string;
  color: string;
}

interface MatrixCell {
  document: Schema['Document']['type'] | null;
  status: DocumentStatus;
}

interface ProjectRow {
  project: Schema['Project']['type'];
  cells: MatrixCell[];
}

@Component({
  selector: 'app-reporting',
  imports: [CommonModule, DynamicFormComponent],
  templateUrl: './reporting.html',
  styleUrl: './reporting.less'
})
export class Reporting implements OnInit {
  projects = signal<Array<Schema['Project']['type']>>([]);
  documents = signal<Array<Schema['Document']['type']>>([]);
  workflows = signal<Array<Schema['Workflow']['type']>>([]);
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  loading = signal(true);
  
  orderedDocumentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  projectMatrix = signal<ProjectRow[]>([]);
  selectedDocument = signal<Schema['Document']['type'] | null>(null);
  showDocumentModal = signal(false);
  saving = signal(false);
  
  dynamicFormService = inject(DynamicFormService);
  versionedDataService = inject(VersionedDataService);

  get isFormValid(): boolean {
    return this.dynamicFormService.isFormValid();
  }

  async ngOnInit() {
    await this.loadAllData();
    this.buildMatrix();
  }

  async loadAllData() {
    try {
      this.loading.set(true);
      
      const [projectsResult, documentsResult, workflowsResult, documentTypesResult] = await Promise.all([
        this.versionedDataService.getAllLatestVersions('Project'),
        this.versionedDataService.getAllLatestVersions('Document'),
        this.versionedDataService.getAllLatestVersions('Workflow'),
        this.versionedDataService.getAllLatestVersions('DocumentType')
      ]);

      this.projects.set(projectsResult.success ? projectsResult.data || [] : []);
      this.documents.set(documentsResult.success ? documentsResult.data || [] : []);
      this.workflows.set(workflowsResult.success ? workflowsResult.data || [] : []);
      this.documentTypes.set(documentTypesResult.success ? documentTypesResult.data || [] : []);
    } catch (error) {
      console.error('Error loading reporting data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  buildMatrix() {
    // Get all unique document types and order them by workflow rules
    const allDocTypes = this.documentTypes();
    const orderedTypes = this.getWorkflowOrderedDocumentTypes(allDocTypes);
    this.orderedDocumentTypes.set(orderedTypes);

    // Build matrix for each project
    const matrix: ProjectRow[] = this.projects().map(project => ({
      project,
      cells: orderedTypes.map(docType => {
        const document = this.findDocumentForProjectAndType(project.id!, docType.id!);
        return {
          document,
          status: this.getDocumentStatus(document)
        };
      })
    }));

    this.projectMatrix.set(matrix);
    
    // Update CSS grid template after data is ready
    this.updateGridTemplate();
  }

  updateGridTemplate() {
    const numColumns = this.orderedDocumentTypes().length + 1; // +1 for project name column
    const gridTemplate = `200px repeat(${this.orderedDocumentTypes().length}, 120px)`;
    
    // Update CSS custom property for grid template
    setTimeout(() => {
      const matrixTable = document.querySelector('.matrix-table') as HTMLElement;
      if (matrixTable) {
        matrixTable.style.gridTemplateColumns = gridTemplate;
      }
    });
  }

  getWorkflowOrderedDocumentTypes(docTypes: Array<Schema['DocumentType']['type']>): Array<Schema['DocumentType']['type']> {
    // Create a dependency map based on workflow rules
    const dependencyMap = new Map<string, Set<string>>();
    const allDocTypeIds = new Set(docTypes.map(dt => dt.id!));

    // Initialize dependency sets
    docTypes.forEach(docType => {
      if (docType.id) {
        dependencyMap.set(docType.id, new Set());
      }
    });

    // Analyze workflow rules to determine dependencies
    this.workflows().forEach(workflow => {
      if (!workflow.rules) return;

      workflow.rules.forEach((ruleString: any) => {
        try {
          const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
          const validation = rule.validation || '';
          const action = rule.action || '';

          // Find document types in validation (prerequisites)
          const validationDocTypes = this.extractDocumentTypeReferences(validation, docTypes);
          // Find document types in action (dependents)
          const actionDocTypes = this.extractDocumentTypeReferences(action, docTypes);

          // If validation mentions doc types, they are prerequisites for action doc types
          validationDocTypes.forEach(prereqId => {
            actionDocTypes.forEach(dependentId => {
              if (prereqId !== dependentId && allDocTypeIds.has(prereqId) && allDocTypeIds.has(dependentId)) {
                dependencyMap.get(dependentId)?.add(prereqId);
              }
            });
          });
        } catch (error) {
          // Skip invalid rule JSON
        }
      });
    });

    // Topological sort to order document types
    return this.topologicalSort(docTypes, dependencyMap);
  }

  extractDocumentTypeReferences(text: string, docTypes: Array<Schema['DocumentType']['type']>): string[] {
    const references: string[] = [];
    docTypes.forEach(docType => {
      if (docType.identifier && text.toLowerCase().includes(docType.identifier.toLowerCase())) {
        references.push(docType.id!);
      }
    });
    return references;
  }

  topologicalSort(docTypes: Array<Schema['DocumentType']['type']>, dependencyMap: Map<string, Set<string>>): Array<Schema['DocumentType']['type']> {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: Array<Schema['DocumentType']['type']> = [];
    const docTypeMap = new Map(docTypes.map(dt => [dt.id!, dt]));

    const visit = (docTypeId: string) => {
      if (temp.has(docTypeId)) return; // Cycle detected, skip
      if (visited.has(docTypeId)) return;

      temp.add(docTypeId);
      const dependencies = dependencyMap.get(docTypeId) || new Set();
      
      dependencies.forEach(depId => {
        if (docTypeMap.has(depId)) {
          visit(depId);
        }
      });

      temp.delete(docTypeId);
      visited.add(docTypeId);
      
      const docType = docTypeMap.get(docTypeId);
      if (docType) {
        result.push(docType);
      }
    };

    // Visit all document types
    docTypes.forEach(docType => {
      if (docType.id) {
        visit(docType.id);
      }
    });

    return result;
  }

  findDocumentForProjectAndType(projectId: string, documentTypeId: string): Schema['Document']['type'] | null {
    return this.documents().find(doc => 
      doc.projectId === projectId && doc.documentType === documentTypeId
    ) || null;
  }

  getDocumentStatus(document: Schema['Document']['type'] | null): DocumentStatus {
    if (!document) {
      return { status: 'queued', icon: '⏳', color: '#95a5a6' }; // Gray for queued/not started
    }

    // Extract status from formData JSON
    let formStatus = null;
    if (document.formData) {
      try {
        const formData = JSON.parse(document.formData);
        // Look for common status field names
        formStatus = formData.status || formData.documentStatus || formData.requestStatus || formData.applicationStatus;
      } catch (error) {
        console.error('Error parsing formData for status:', error);
      }
    }

    // Use formData status if available, otherwise fall back to document.status
    const status = formStatus || document.status;

    switch (status?.toLowerCase()) {
      case 'requested':
      case 'submitted':
      case 'pending':
      case 'accepted':
      case 'in progress':
      case 'inprogress':
      case 'processing':
        return { status: 'waiting', icon: '⏰', color: '#f39c12' }; // Yellow for waiting
      case 'provided':
      case 'completed':
      case 'approved':
      case 'finished':
      case 'done':
        return { status: 'completed', icon: '✅', color: '#27ae60' }; // Green for completed
      case 'rejected':
      case 'denied':
      case 'declined':
        return { status: 'rejected', icon: '❌', color: '#e74c3c' }; // Red for rejected
      case 'amended':
      case 'revision':
      case 'needs revision':
      case 'needsrevision':
        return { status: 'amended', icon: '🔄', color: '#9b59b6' }; // Purple for amended
      case 'queued':
      case 'draft':
      case 'not started':
      case 'notstarted':
        return { status: 'queued', icon: '⏳', color: '#95a5a6' }; // Gray for queued
      default:
        return { status: 'queued', icon: '⏳', color: '#95a5a6' }; // Default to queued
    }
  }

  getProjectName(projectId: string): string {
    const project = this.projects().find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  }

  getDocumentTypeName(documentTypeId: string): string {
    const docType = this.documentTypes().find(dt => dt.id === documentTypeId);
    return docType?.name || 'Unknown Type';
  }

  getFormStatus(document: Schema['Document']['type']): string {
    if (!document.formData) {
      return document.status || 'queued';
    }

    try {
      const formData = JSON.parse(document.formData);
      // Look for common status field names in the form data
      const formStatus = formData.status || formData.documentStatus || formData.requestStatus || formData.applicationStatus;
      return formStatus || document.status || 'queued';
    } catch (error) {
      console.error('Error parsing formData for status display:', error);
      return document.status || 'queued';
    }
  }

  async openDocumentModal(document: Schema['Document']['type'] | null) {
    if (document) {
      this.selectedDocument.set(document);
      
      // Load the document type and initialize dynamic form (same as documents page)
      this.onDocumentTypeChange(document.documentType);
      
      // Load existing form data if available
      if (document.formData) {
        try {
          const existingData = JSON.parse(document.formData);
          setTimeout(() => {
            this.dynamicFormService.patchFormValue(existingData);
          }, 100);
        } catch (error) {
          console.error('Error loading existing form data:', error);
        }
      }
      
      this.showDocumentModal.set(true);
    }
  }

  onDocumentTypeChange(documentTypeId: string) {
    const documentType = this.documentTypes().find(dt => dt.id === documentTypeId);
    
    if (documentType && documentType.definition) {
      this.dynamicFormService.generateDynamicFormSchema(documentType.definition);
      
      // Reset rules first
      this.dynamicFormService.workflowRules.set([]);
      
      // Load validation rules from document type
      const documentTypeWithRules = documentType as any;
      if (documentTypeWithRules.validationRules) {
        this.dynamicFormService.loadWorkflowRulesFromText(documentTypeWithRules.validationRules);
      }
      
      // Also load workflow rules from project workflow if available
      const document = this.selectedDocument();
      if (document) {
        this.loadWorkflowRulesForDocumentType(document.projectId, documentTypeId);
      }
    } else {
      this.dynamicFormService.resetForm();
    }
  }

  async loadWorkflowRulesForDocumentType(projectId: string, documentTypeId: string) {
    try {
      // Find the project and its workflow
      const project = this.projects().find(p => p.id === projectId);
      if (!project || !project.workflowId) return;

      const workflow = this.workflows().find(w => w.id === project.workflowId);
      if (!workflow || !workflow.rules) return;

      // Extract rules for this document type
      const relevantRules: string[] = [];
      workflow.rules.forEach((ruleString: any) => {
        try {
          const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
          const validation = rule.validation || '';
          const action = rule.action || '';
          
          // Get document type identifier
          const documentType = this.documentTypes().find(dt => dt.id === documentTypeId);
          if (documentType?.identifier) {
            const identifier = documentType.identifier.toLowerCase();
            if (validation.toLowerCase().includes(identifier) || action.toLowerCase().includes(identifier)) {
              relevantRules.push(`validation: ${validation} action: ${action}`);
            }
          }
        } catch (error) {
          // Skip invalid rule JSON
        }
      });

      // Load workflow rules into dynamic form service
      if (relevantRules.length > 0) {
        this.dynamicFormService.loadWorkflowRulesFromText(relevantRules.join('\n'));
      }
    } catch (error) {
      console.error('Error loading workflow rules:', error);
    }
  }

  closeDocumentModal() {
    this.selectedDocument.set(null);
    this.showDocumentModal.set(false);
    this.dynamicFormService.resetForm();
  }

  async saveDocument() {
    const document = this.selectedDocument();
    if (!document) return;

    try {
      this.saving.set(true);
      
      if (!this.isFormValid) {
        this.dynamicFormService.markAllFieldsAsTouched();
        alert('Please fill in all required fields correctly.');
        this.saving.set(false);
        return;
      }

      const dynamicFormValue = this.dynamicFormService.dynamicFormGroup()?.value;
      
      // Update the document with new form data using versioned service
      const result = await this.versionedDataService.updateVersionedRecord('Document', document.id, {
        formData: JSON.stringify(dynamicFormValue)
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update document');
      }

      // Refresh data and rebuild matrix to show updated status
      await this.loadAllData();
      this.buildMatrix();
      
      // Close modal
      this.closeDocumentModal();
      
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
