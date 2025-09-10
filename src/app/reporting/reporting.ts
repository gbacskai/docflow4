import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { DynamicFormService } from '../services/dynamic-form.service';
import { VersionedDataService } from '../services/versioned-data.service';
import { WorkflowService } from '../services/workflow.service';
import { AuthService } from '../services/auth.service';
import { UserDataService } from '../services/user-data.service';
import { ProjectOperationsService } from '../services/project-operations.service';
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
  imports: [CommonModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './reporting.html',
  styleUrl: './reporting.less'
})
export class Reporting implements OnInit, OnDestroy {
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
  executingWorkflow = signal(false);
  showAllProjects = signal(true); // By default, show all projects since toggle was removed
  
  // New Project functionality
  users = signal<Array<Schema['User']['type']>>([]);
  showNewProjectModal = signal(false);
  creatingProject = signal(false);
  editingProject = signal(false);
  selectedProject = signal<Schema['Project']['type'] | null>(null);
  currentMode = signal<'create' | 'edit'>('create');
  
  dynamicFormService = inject(DynamicFormService);
  versionedDataService = inject(VersionedDataService);
  workflowService = inject(WorkflowService);
  authService = inject(AuthService);
  userDataService = inject(UserDataService);
  projectOperationsService = inject(ProjectOperationsService);
  fb = inject(FormBuilder);
  router = inject(Router);

  // Event listener reference for cleanup
  private newProjectModalHandler = () => {
    this.openNewProjectModal();
  };

  newProjectForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    ownerId: ['', [Validators.required]],
    workflowId: ['', [Validators.required]],
    status: ['active', [Validators.required]]
  });

  get isFormValid(): boolean {
    return this.dynamicFormService.isFormValid();
  }

  async ngOnInit() {
    await this.loadAllData();
    this.buildMatrix();
    
    // Listen for new project modal events from app component
    window.addEventListener('openNewProjectModal', this.newProjectModalHandler);
  }

  ngOnDestroy() {
    // Clean up event listener
    window.removeEventListener('openNewProjectModal', this.newProjectModalHandler);
  }

  async loadAllData() {
    try {
      this.loading.set(true);
      
      const [projectsResult, documentsResult, workflowsResult, documentTypesResult, usersResult] = await Promise.all([
        this.versionedDataService.getAllLatestVersions('Project'),
        this.versionedDataService.getAllLatestVersions('Document'),
        this.versionedDataService.getAllLatestVersions('Workflow'),
        this.versionedDataService.getAllLatestVersions('DocumentType'),
        this.versionedDataService.getAllLatestVersions('User')
      ]);

      const projectsData = projectsResult.success ? projectsResult.data || [] : [];
      const documentsData = documentsResult.success ? documentsResult.data || [] : [];
      const workflowsData = workflowsResult.success ? workflowsResult.data || [] : [];
      const documentTypesData = documentTypesResult.success ? documentTypesResult.data || [] : [];
      const usersData = usersResult.success ? usersResult.data || [] : [];

      console.log('📊 Loaded data counts:', {
        projects: projectsData.length,
        documents: documentsData.length,
        workflows: workflowsData.length,
        documentTypes: documentTypesData.length,
        users: usersData.length
      });

      this.projects.set(projectsData);
      this.documents.set(documentsData);
      this.workflows.set(workflowsData);
      this.documentTypes.set(documentTypesData);
      this.users.set(usersData);
    } catch (error) {
      console.error('Error loading reporting data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  buildMatrix() {
    // Filter projects based on showAllProjects setting
    const filteredProjects = this.getFilteredProjects();
    console.log('🔧 Building matrix with filtered projects:', filteredProjects.length);
    console.log('🔧 Filtered project details:', filteredProjects.map(p => ({ id: p.id, name: p.name })));

    // Debug: Check documents signal
    console.log('🔧 Total documents in signal:', this.documents().length);
    console.log('🔧 Sample documents:', this.documents().slice(0, 3).map(d => ({ 
      id: d.id, 
      projectId: d.projectId, 
      documentType: d.documentType 
    })));

    // Get only document types that have actual documents in the filtered projects
    const usedDocumentTypeIds = new Set<string>();
    const projectDocuments = new Map<string, string[]>(); // project -> document types
    
    // Debug: Track which documents belong to which projects
    const projectDocumentMatches = new Map<string, number>();
    
    this.documents().forEach(doc => {
      const matchingProject = filteredProjects.find(project => project.id === doc.projectId);
      if (matchingProject) {
        usedDocumentTypeIds.add(doc.documentType);
        
        // Track which document types each project has
        if (!projectDocuments.has(doc.projectId)) {
          projectDocuments.set(doc.projectId, []);
        }
        projectDocuments.get(doc.projectId)!.push(doc.documentType);
        
        // Count documents per project
        projectDocumentMatches.set(doc.projectId, (projectDocumentMatches.get(doc.projectId) || 0) + 1);
      }
    });
    
    console.log('🔧 Document matches per project:', Object.fromEntries(projectDocumentMatches));

    console.log('🔧 Used document type IDs:', Array.from(usedDocumentTypeIds));
    console.log('🔧 Project documents breakdown:', Object.fromEntries(
      Array.from(projectDocuments.entries()).map(([projectId, docTypes]) => {
        const project = filteredProjects.find(p => p.id === projectId);
        const docTypeNames = docTypes.map(dtId => {
          const dt = this.documentTypes().find(d => d.id === dtId);
          return dt?.name || dtId;
        });
        return [project?.name || projectId, `${docTypes.length} types: ${docTypeNames.join(', ')}`];
      })
    ));

    // Filter to only used document types
    const usedDocTypes = this.documentTypes().filter(docType => 
      usedDocumentTypeIds.has(docType.id!)
    );
    
    console.log('🔧 Used document types:', usedDocTypes.map(dt => ({ id: dt.id, name: dt.name })));
    
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
    const numColumns = this.orderedDocumentTypes().length + 1; // +1 for project name column only
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
    console.log('📋 All projects:', allProjects.map(p => ({ id: p.id, name: p.name, status: p.status })));
    
    if (this.showAllProjects()) {
      console.log('📋 Showing all projects');
      return allProjects;
    }
    
    // Show only active projects by default
    const activeProjects = allProjects.filter(project => project.status === 'active');
    console.log('📋 Active projects only:', activeProjects.map(p => ({ id: p.id, name: p.name, status: p.status })));
    return activeProjects;
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
      
      // Execute workflow rules for the project after document save
      console.log('🔄 Running workflow rules after document save...');
      this.executingWorkflow.set(true);
      try {
        const workflowResult = await this.workflowService.executeWorkflowRulesForProject(
          document.projectId!, 
          document.id
        );
        
        if (workflowResult.success) {
          console.log(`✅ Cascading workflow execution completed: ${workflowResult.cascadeIterations} iterations, ${workflowResult.totalDocumentChanges} total changes`);
          
          if (workflowResult.totalDocumentChanges > 0) {
            console.log('📋 Applied actions:', workflowResult.appliedActions);
            
            // Show detailed user feedback about cascading workflow execution
            const message = `Cascading workflow executed successfully!\n\n` +
              `🔄 Cascade Iterations: ${workflowResult.cascadeIterations}\n` +
              `📊 Rules Processed: ${workflowResult.executedRules}\n` +
              `⚡ Actions Applied: ${workflowResult.appliedActions.length}\n` +
              `📄 Documents Changed: ${workflowResult.totalDocumentChanges}\n\n` +
              `The system automatically ran validation rules until no more changes occurred.`;
            
            //alert(message);
            
            // Always refresh data after cascading changes
            console.log('🔄 Refreshing data due to cascading workflow updates...');
            await this.loadAllData();
            this.buildMatrix();
          } else {
            // No changes occurred
            console.log('ℹ️ No workflow rules triggered any document changes');
            // alert('Document saved successfully!\n\nNo workflow rules required changes to other documents.');
          }
        } else {
          console.error('❌ Cascading workflow execution failed:', workflowResult.error);
          // alert(`Cascading workflow execution failed: ${workflowResult.error}`);
        }
      } catch (error) {
        console.error('❌ Error running workflow rules:', error);
        // alert(`Error running workflow rules: ${error}`);
      } finally {
        this.executingWorkflow.set(false);
      }
      
      // Close modal
      this.closeDocumentModal();
      
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  navigateToProjectChat(project: Schema['Project']['type']) {
    // Navigate to chat page with query parameters to select the project
    this.router.navigate(['/chat'], {
      queryParams: {
        projectId: project.id,
        projectName: project.name,
        from: 'reporting'
      }
    });
  }

  // New Project functionality
  isCurrentUserAdmin(): boolean {
    return this.userDataService.isCurrentUserAdmin();
  }

  openNewProjectModal() {
    this.currentMode.set('create');
    this.selectedProject.set(null);
    this.showNewProjectModal.set(true);
    this.setCurrentUserAsOwner();
  }

  openEditProjectModal(project: Schema['Project']['type']) {
    this.currentMode.set('edit');
    this.selectedProject.set(project);
    this.showNewProjectModal.set(true);
    
    // Populate form with existing project data
    this.newProjectForm.patchValue({
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      workflowId: project.workflowId || '',
      status: project.status
    });
  }

  closeNewProjectModal() {
    this.showNewProjectModal.set(false);
    this.newProjectForm.reset();
    this.newProjectForm.patchValue({ status: 'active' });
    this.creatingProject.set(false);
    this.editingProject.set(false);
    this.currentMode.set('create');
    this.selectedProject.set(null);
  }

  async setCurrentUserAsOwner() {
    const currentUser = this.authService.currentUser();
    if (currentUser?.email) {
      // Find current user in users list
      const currentUserId = this.users().find(u => u.email === currentUser.email)?.id;
      
      if (currentUserId) {
        this.newProjectForm.patchValue({ 
          ownerId: currentUserId,
          status: 'active'
        });
      }
    }
  }

  getUserName(userId: string): string {
    const user = this.users().find(u => u.id === userId);
    if (!user) return 'Unknown User';
    
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.email || 'Unknown User';
  }

  getWorkflowName(workflowId: string): string {
    const workflow = this.workflows().find(w => w.id === workflowId);
    return workflow ? workflow.name : 'Unknown workflow';
  }

  async onSubmitNewProject() {
    if (this.newProjectForm.valid) {
      if (this.currentMode() === 'create') {
        this.creatingProject.set(true);
      } else {
        this.editingProject.set(true);
      }
      
      const formValue = this.newProjectForm.value;
      const projectData: any = {
        name: formValue.name,
        description: formValue.description,
        ownerId: formValue.ownerId,
        adminUsers: [], // Empty admin users for simplicity
        workflowId: formValue.workflowId,
        status: formValue.status as 'active' | 'completed' | 'archived'
      };

      // Only add identifier for new projects
      if (this.currentMode() === 'create') {
        projectData.identifier = formValue.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      }
      
      console.log('📋 Project data prepared:', projectData);

      try {
        let projectResult: any = null;
        
        if (this.currentMode() === 'create') {
          projectResult = await this.createProject(projectData);
        } else {
          const projectId = this.selectedProject()!.id;
          console.log('📝 About to update project:', { projectId, projectData });
          projectResult = await this.updateProject(projectId, projectData);
          console.log('✅ Project update completed, reloading data...');
        }
        
        this.closeNewProjectModal();
        
        // Extended delay to ensure all database operations are fully completed
        console.log('⏳ Waiting for database operations to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Only do retry for create operations with valid project result
        if (this.currentMode() === 'create' && projectResult?.data) {
          // Retry data loading until all documents are found (up to 5 attempts)
          console.log('🔄 Reloading all data after project creation...');
          const newProject = projectResult.data;
          console.log('🔄 New project created:', { id: newProject.id, name: newProject.name });
          let attempts = 0;
          let foundDocuments = 0;
        
        while (attempts < 5 && foundDocuments < 19) {
          attempts++;
          console.log(`🔄 Attempt ${attempts}: Loading data...`);
          
          await this.loadAllData();
          
          const newProjectDocuments = this.documents().filter(doc => doc.projectId === newProject.id);
          foundDocuments = newProjectDocuments.length;
          
          console.log(`🔍 Attempt ${attempts}: Found ${foundDocuments} documents for new project ${newProject.name} (expected 19)`);
          console.log(`🔍 Total documents in system: ${this.documents().length}`);
          
          if (foundDocuments >= 19) {
            console.log('✅ All documents found!');
            break;
          } else {
            console.log(`⏳ Missing ${19 - foundDocuments} documents, waiting 3 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
        // Final document list
        const finalProjectDocuments = this.documents().filter(doc => doc.projectId === newProject.id);
        console.log(`📋 Final document list (${finalProjectDocuments.length} found):`);
        finalProjectDocuments.forEach(doc => {
          const docType = this.documentTypes().find(dt => dt.id === doc.documentType);
          console.log(`  - ${docType?.name || doc.documentType} (${doc.id})`);
        });
        
        // Show summary of the issue
        if (finalProjectDocuments.length < 19) {
          console.log('🚨 CRITICAL ISSUE DETECTED:');
          console.log(`   • Created: 19 documents (confirmed by creation logs)`);
          console.log(`   • Found: ${finalProjectDocuments.length} documents`);
          console.log(`   • Missing: ${19 - finalProjectDocuments.length} documents`);
          console.log('   • Root cause: getAllLatestVersions("Document") not returning all active documents');
          console.log('   • This is likely due to AWS DynamoDB query limitations or index issues');
        }
        
          // Additional delay after data loading to ensure all documents are loaded
          console.log('⏳ Additional wait after data loading...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // For update operations, just reload data once
          console.log('🔄 Reloading data after project update...');
          await this.loadAllData();
        }
        
        console.log('🔧 Building matrix after data reload...');
        this.buildMatrix();
        console.log('✅ Matrix rebuild completed');
      } catch (error) {
        console.error('Error saving project:', error);
        alert('Failed to save project: ' + (error as Error).message);
      } finally {
        this.creatingProject.set(false);
        this.editingProject.set(false);
      }
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.newProjectForm.controls).forEach(key => {
        this.newProjectForm.get(key)?.markAsTouched();
      });
    }
  }

  async createProject(project: any) {
    try {
      console.log('Creating project with enhanced shared service:', project);
      
      const result = await this.projectOperationsService.createProject(
        project,
        this.workflows(),
        this.documentTypes()
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create project');
      }
      
      console.log('✅ Project created successfully with shared service:', result.data);
      return result;
      
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  async updateProject(id: string, updates: any) {
    try {
      console.log('📝 Updating project with enhanced shared service:', id, updates);
      
      // Create a clean update object
      const cleanUpdates: any = {
        name: updates.name,
        description: updates.description,
        ownerId: updates.ownerId,
        workflowId: updates.workflowId,
        status: updates.status
      };

      // Ensure status is a valid enum value
      if (!['active', 'completed', 'archived'].includes(cleanUpdates.status)) {
        console.warn('⚠️ Invalid status value, defaulting to "active":', cleanUpdates.status);
        cleanUpdates.status = 'active';
      }

      // Remove null/undefined values to avoid GraphQL issues
      Object.keys(cleanUpdates).forEach(key => {
        if (cleanUpdates[key] === null || cleanUpdates[key] === undefined) {
          delete cleanUpdates[key];
        }
      });
      
      const result = await this.projectOperationsService.updateProject(
        id,
        cleanUpdates,
        this.workflows(),
        this.documentTypes(),
        this.documents()
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update project');
      }
      
      console.log('✅ Project updated successfully with shared service:', result.data);
      return result;
      
    } catch (error) {
      console.error('❌ Error in updateProject:', error);
      throw error;
    }
  }

  /**
   * Extract document types that are referenced in a workflow's rules
   */
  getDocumentTypesFromWorkflow(workflow?: Schema['Workflow']['type'] | null): Array<Schema['DocumentType']['type']> {
    if (!workflow || !workflow.rules || workflow.rules.length === 0) {
      return [];
    }

    const docTypeNames = new Set<string>();
    
    // Extract document type names from workflow rules
    workflow.rules.forEach((ruleString: any) => {
      try {
        const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
        const validation = rule.validation || '';
        const action = rule.action || '';
        
        this.extractDocTypeNamesFromText(validation, docTypeNames);
        this.extractDocTypeNamesFromText(action, docTypeNames);
      } catch (error) {
        console.error('Error parsing workflow rule:', ruleString, error);
      }
    });

    // Find matching DocumentType objects
    const matchedDocTypes = this.documentTypes().filter(docType => {
      const isActive = docType.isActive;
      let isReferenced = false;
      
      // Match by identifier first
      if (docType.identifier && docTypeNames.has(docType.identifier)) {
        isReferenced = true;
      }
      
      // Fallback to name matching
      if (!isReferenced && docTypeNames.has(docType.name)) {
        isReferenced = true;
      }
      
      return isActive && isReferenced;
    });

    return matchedDocTypes;
  }

  private extractDocTypeNamesFromText(text: string, docTypeNames: Set<string>) {
    // Pattern: document.DocumentTypeName.status or DocumentTypeName.status
    const docTypePatterns = [
      /document\.([A-Z][a-zA-Z0-9]*)\./g,  // document.DocumentTypeName.status
      /([A-Z][a-zA-Z0-9]+)\.(?:status|value|hidden|disabled)/g  // DocumentTypeName.status
    ];
    
    docTypePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const docTypeName = match[1];
        docTypeNames.add(docTypeName);
      }
    });
  }
}
