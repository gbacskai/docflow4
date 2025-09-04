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
  showAllProjects = signal(false); // By default, show only active projects
  
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
    // Filter projects based on showAllProjects setting
    const filteredProjects = this.getFilteredProjects();

    // Get only document types that have actual documents in the filtered projects
    const usedDocumentTypeIds = new Set<string>();
    this.documents().forEach(doc => {
      if (filteredProjects.some(project => project.id === doc.projectId)) {
        usedDocumentTypeIds.add(doc.documentType);
      }
    });

    // Filter to only used document types
    const usedDocTypes = this.documentTypes().filter(docType => 
      usedDocumentTypeIds.has(docType.id!)
    );
    
    // Order the used document types by workflow rules
    const orderedTypes = this.getWorkflowOrderedDocumentTypes(usedDocTypes);
    this.orderedDocumentTypes.set(orderedTypes);

    // Build matrix for each project
    const matrix: ProjectRow[] = filteredProjects.map((project: Schema['Project']['type']) => ({
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
    const gridTemplate = `200px repeat(${this.orderedDocumentTypes().length}, 60px)`;
    
    // Update CSS custom property for grid template
    setTimeout(() => {
      const matrixTable = document.querySelector('.matrix-table') as HTMLElement;
      if (matrixTable) {
        matrixTable.style.gridTemplateColumns = gridTemplate;
      }
    });
  }

  getFilteredProjects(): Array<Schema['Project']['type']> {
    const allProjects = this.projects();
    
    if (this.showAllProjects()) {
      return allProjects;
    }
    
    // Show only active projects by default
    return allProjects.filter(project => project.status === 'active');
  }

  toggleShowAllProjects() {
    this.showAllProjects.set(!this.showAllProjects());
    this.buildMatrix(); // Rebuild matrix with new filter
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

    // Extract status from formData JSON - prioritize form data status
    let formStatus = null;
    if (document.formData) {
      try {
        const formData = JSON.parse(document.formData);
        // Debug logging to see what's in the form data
        console.log('Document formData:', document.formData);
        console.log('Parsed formData:', formData);
        
        // Look for common status field names in priority order
        formStatus = formData.status || formData.documentStatus || formData.requestStatus || formData.applicationStatus || 
                    formData.documentRequestStatus || formData.permitStatus || formData.approvalStatus || 
                    formData.submissionStatus || formData.reviewStatus || formData.processingStatus;
        
        // Handle boolean confirmation fields (e.g., confirmed: true means completed)
        if (!formStatus && formData.confirmed === true) {
          formStatus = 'completed';
        }
        
        // Handle notrequired field 
        if (!formStatus && formData.notrequired === true) {
          formStatus = 'not required';
        }
        
        // Handle documents that have form fields but no explicit status
        if (!formStatus && Object.keys(formData).length > 0) {
          // If document has files uploaded, consider it completed
          if (formData.files && formData.files !== '' && formData.files !== null) {
            formStatus = 'completed';
          } else {
            // If document has form data but no files/status, assume it's queued (being worked on)
            formStatus = 'queued';
          }
        }
        
        // If no standard status fields found, search for any field containing "status"
        if (!formStatus) {
          const statusFields = Object.keys(formData).filter(key => key.toLowerCase().includes('status'));
          if (statusFields.length > 0) {
            formStatus = formData[statusFields[0]]; // Use first status field found
          }
        }
        
        console.log('All formData keys:', Object.keys(formData));
        console.log('Extracted formStatus:', formStatus);
      } catch (error) {
        console.error('Error parsing formData for status:', error);
      }
    }

    // Use formData status, show error if no status field found
    const status = formStatus !== null && formStatus !== undefined ? formStatus : 'error';

    switch (status?.toLowerCase()) {
      // Primary status configuration
      case 'queued':
        return { status: 'queued', icon: '⏳', color: '#95a5a6' }; // Gray for queued
      case 'waiting':
        return { status: 'waiting', icon: '⏰', color: '#f39c12' }; // Yellow for waiting
      case 'completed':
        return { status: 'completed', icon: '✅', color: '#27ae60' }; // Green for completed
      case 'confirmed':
        return { status: 'confirmed', icon: '✅', color: '#27ae60' }; // Green for confirmed
      case 'notrequired':
      case 'not required':
        return { status: 'not_required', icon: '🚫', color: '#34495e' }; // Dark gray for not required
      
      // Additional status mappings
      case 'requested':
      case 'submitted':
      case 'pending':
      case 'accepted':
      case 'in progress':
      case 'inprogress':
      case 'processing':
        return { status: 'waiting', icon: '⏰', color: '#f39c12' }; // Yellow for waiting
      case 'provided':
      case 'approved':
      case 'finished':
      case 'done':
        return { status: 'completed', icon: '✅', color: '#27ae60' }; // Green for completed
      case 'project completed':
      case 'project_completed':
      case 'projectcompleted':
      case 'fully completed':
      case 'fully_completed':
        return { status: 'project_completed', icon: '🏆', color: '#f39c12' }; // Gold trophy for project completion
      case 'rejected':
      case 'denied':
      case 'declined':
        return { status: 'rejected', icon: '❌', color: '#e74c3c' }; // Red for rejected
      case 'amended':
      case 'revision':
      case 'needs revision':
      case 'needsrevision':
        return { status: 'amended', icon: '🔄', color: '#9b59b6' }; // Purple for amended
      case 'not_required':
      case 'n/a':
      case 'na':
      case 'skip':
      case 'skipped':
        return { status: 'not_required', icon: '🚫', color: '#34495e' }; // Dark gray for not required
      case 'draft':
      case 'not started':
      case 'notstarted':
        return { status: 'queued', icon: '⏳', color: '#95a5a6' }; // Gray for queued
      case 'error':
        return { status: 'error', icon: '⚠️', color: '#e67e22' }; // Orange warning for missing status
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
      return 'error';
    }

    try {
      const formData = JSON.parse(document.formData);
      // Look for common status field names in the form data
      let formStatus = formData.status || formData.documentStatus || formData.requestStatus || formData.applicationStatus || 
                      formData.documentRequestStatus || formData.permitStatus || formData.approvalStatus || 
                      formData.submissionStatus || formData.reviewStatus || formData.processingStatus;
      
      // Handle boolean confirmation fields (e.g., confirmed: true means completed)
      if (!formStatus && formData.confirmed === true) {
        formStatus = 'completed';
      }
      
      // Handle notrequired field 
      if (!formStatus && formData.notrequired === true) {
        formStatus = 'not required';
      }
      
      // Handle documents that have form fields but no explicit status
      if (!formStatus && Object.keys(formData).length > 0) {
        // If document has files uploaded, consider it completed
        if (formData.files && formData.files !== '' && formData.files !== null) {
          formStatus = 'completed';
        } else {
          // If document has form data but no files/status, assume it's queued (being worked on)
          formStatus = 'queued';
        }
      }
      
      // If no standard status fields found, search for any field containing "status"
      if (!formStatus) {
        const statusFields = Object.keys(formData).filter(key => key.toLowerCase().includes('status'));
        if (statusFields.length > 0) {
          formStatus = formData[statusFields[0]]; // Use first status field found
        }
      }
      return formStatus !== null && formStatus !== undefined ? formStatus : 'error';
    } catch (error) {
      console.error('Error parsing formData for status display:', error);
      return 'error';
    }
  }

  async openDocumentModal(document: Schema['Document']['type'] | null) {
    if (document) {
      this.selectedDocument.set(document);
      
      // Generate dynamic form for the document type
      await this.onDocumentTypeChange(document.documentType);
      
      // Populate dynamic form with existing data if available (match documents component approach)
      const documentWithFormData = document as any;
      if (documentWithFormData.formData) {
        try {
          const existingData = JSON.parse(documentWithFormData.formData);
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

  async onDocumentTypeChange(documentTypeId: string) {
    const documentType = this.documentTypes().find(dt => dt.id === documentTypeId);
    
    if (documentType && documentType.definition) {
      this.dynamicFormService.generateDynamicFormSchema(documentType.definition);
      
      // Setup form change listeners for validation
      this.dynamicFormService.setupFormChangeListeners();
      
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
        const project = this.projects().find(p => p.id === document.projectId);
        if (project?.workflowId) {
          const documentTypeName = this.getDocumentTypeName(documentTypeId);
          await this.dynamicFormService.loadWorkflowRulesForDocumentType(
            documentTypeId, 
            documentTypeName, 
            this.workflows(), 
            project.workflowId
          );
        }
      }
    } else {
      this.dynamicFormService.resetForm();
    }
  }


  updateMatrixForDocument(documentId: string, formData: any) {
    // Create updated document object
    const updatedDocument = this.documents().find(doc => doc.id === documentId);
    if (!updatedDocument) return;
    
    // Update the matrix cells for this document
    const currentMatrix = this.projectMatrix();
    const updatedMatrix = currentMatrix.map(row => ({
      ...row,
      cells: row.cells.map(cell => {
        if (cell.document?.id === documentId) {
          return {
            ...cell,
            document: { ...updatedDocument, formData: JSON.stringify(formData) },
            status: this.getDocumentStatus({ ...updatedDocument, formData: JSON.stringify(formData) })
          };
        }
        return cell;
      })
    }));
    
    this.projectMatrix.set(updatedMatrix);
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

      let dynamicFormValue = this.dynamicFormService.getFormValue();
      
      // Handle file uploads if there are any
      let uploadedFileUrls = {};
      if (Object.keys(this.dynamicFormService.fileObjects()).length > 0) {
        uploadedFileUrls = await this.dynamicFormService.uploadFilesForDocument(document.id);
        // Merge uploaded file URLs with existing form data
        dynamicFormValue = { ...dynamicFormValue, ...uploadedFileUrls };
      }
      
      // Debug logging to see what form data is being saved
      console.log('Saving document with form data:', dynamicFormValue);
      console.log('Serialized form data:', JSON.stringify(dynamicFormValue));
      
      // Update the document with new form data using versioned service
      const result = await this.versionedDataService.updateVersionedRecord('Document', document.id, {
        formData: JSON.stringify(dynamicFormValue)
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update document');
      }

      // Update only the specific document in the documents array
      const updatedDocuments = this.documents().map(doc => 
        doc.id === document.id 
          ? { ...doc, formData: JSON.stringify(dynamicFormValue), updatedAt: new Date().toISOString() }
          : doc
      );
      this.documents.set(updatedDocuments);
      
      // Update only the affected matrix cells without rebuilding the entire matrix
      this.updateMatrixForDocument(document.id!, dynamicFormValue);
      
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
