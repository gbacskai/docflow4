import { Component, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';
import { ChatService } from '../services/chat.service';
import { VersionedDataService } from '../services/versioned-data.service';
import { UserDataService } from '../services/user-data.service';
import { DynamicFormService } from '../services/dynamic-form.service';
import { DynamicFormComponent } from '../shared/dynamic-form.component';

@Component({
  selector: 'app-documents',
  imports: [CommonModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './documents.html',
  styleUrl: './documents.less'
})
export class Documents implements OnInit {
  documents = signal<Array<Schema['Document']['type']>>([]);
  filteredDocuments = signal<Array<Schema['Document']['type']>>([]);
  documentSearchQuery = signal<string>('');
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  projects = signal<Array<Schema['Project']['type']>>([]);
  workflows = signal<Array<Schema['Workflow']['type']>>([]);
  loading = signal(true);
  loadingDocumentTypes = signal(false);
  loadingProjects = signal(false);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedDocument = signal<Schema['Document']['type'] | null>(null);
  processing = signal(false);
  
  private documentSearchTimeout: any = null;
  
  private fb = inject(FormBuilder);
  private versionedDataService = inject(VersionedDataService);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private userDataService = inject(UserDataService);
  dynamicFormService = inject(DynamicFormService);
  
  documentForm: FormGroup = this.fb.group({
    projectId: ['', [Validators.required]],
    documentType: ['', [Validators.required]]
  });

  get isFormValid(): boolean {
    const mainFormValid = this.documentForm.valid;
    const dynamicFormGroup = this.dynamicFormService.dynamicFormGroup();
    const dynamicFormValid = !dynamicFormGroup || dynamicFormGroup.valid;
    return mainFormValid && dynamicFormValid;
  }

  async ngOnInit() {
    await Promise.all([
      this.loadDocuments(), 
      this.loadDocumentTypes(),
      this.loadProjects(),
      this.loadWorkflows()
    ]);
    
    // Setup document type change listener
    this.documentForm.get('documentType')?.valueChanges.subscribe((documentTypeId) => {
      if (documentTypeId) {
        this.onDocumentTypeChange(documentTypeId);
      } else {
        this.dynamicFormService.resetForm();
      }
    });
  }

  async loadDocuments() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('Document');
        const data = result.success ? result.data || [] : [];
      this.documents.set(data);
      this.applyDocumentSearch(); // Initialize filtered documents
    } catch (error) {
      this.documents.set([]);
      this.filteredDocuments.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  onDocumentSearchInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.documentSearchQuery.set(input.value);
    
    // Clear existing timeout
    if (this.documentSearchTimeout) {
      clearTimeout(this.documentSearchTimeout);
    }
    
    // Debounce search for better performance
    this.documentSearchTimeout = setTimeout(() => {
      this.applyDocumentSearch();
    }, 300);
  }

  clearDocumentSearch(): void {
    this.documentSearchQuery.set('');
    this.applyDocumentSearch();
  }

  applyDocumentSearch(): void {
    const query = this.documentSearchQuery().toLowerCase().trim();
    
    if (!query) {
      this.filteredDocuments.set(this.documents());
      return;
    }

    const filtered = this.documents().filter(document => {
      const projectName = this.getProjectName(document.projectId).toLowerCase();
      const documentTypeName = this.getDocumentTypeName(document.documentType).toLowerCase();
      
      return projectName.includes(query) || documentTypeName.includes(query);
    });

    this.filteredDocuments.set(filtered);
  }

  async loadDocumentTypes() {
    try {
      this.loadingDocumentTypes.set(true);
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('DocumentType');
        const data = result.success ? result.data || [] : [];
      this.documentTypes.set(data);
    } catch (error) {
      this.documentTypes.set([]);
    } finally {
      this.loadingDocumentTypes.set(false);
    }
  }

  async loadProjects() {
    try {
      this.loadingProjects.set(true);
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('Project');
        const data = result.success ? result.data || [] : [];
      
      // Show all projects (not just active) for document viewing/editing
      this.projects.set(data);
    } catch (error) {
      this.projects.set([]);
    } finally {
      this.loadingProjects.set(false);
    }
  }

  async loadWorkflows() {
    try {
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('Workflow');
        const data = result.success ? result.data || [] : [];
      this.workflows.set(data.filter(workflow => workflow.isActive));
    } catch (error) {
      this.workflows.set([]);
    }
  }

  openCreateForm() {
    this.currentMode.set('create');
    this.selectedDocument.set(null);
    this.documentForm.reset();
    
    // Ensure fields are enabled for create mode
    this.documentForm.get('projectId')?.enable();
    this.documentForm.get('documentType')?.enable();
    
    this.showForm.set(true);
  }

  openEditForm(document: Schema['Document']['type']) {
    this.currentMode.set('edit');
    this.selectedDocument.set(document);
    
    this.documentForm.patchValue({
      projectId: document.projectId,
      documentType: document.documentType
    });
    
    // Disable project and document type fields in edit mode
    this.documentForm.get('projectId')?.disable();
    this.documentForm.get('documentType')?.disable();
    
    // Generate dynamic form for the document type
    this.onDocumentTypeChange(document.documentType);
    
    // Populate dynamic form with existing data if available
    const documentWithFormData = document as any;
    if (documentWithFormData.formData) {
      try {
        const existingData = JSON.parse(documentWithFormData.formData);
        console.log(`🔄 Loading existing document data for edit mode:`, existingData);
        console.log(`🔄 Raw formData from database:`, documentWithFormData.formData);
        
        // Patch form with existing data after form generation is complete
        // This ensures that even if the document type schema has changed,
        // we only populate fields that still exist in the current schema
        setTimeout(() => {
          this.dynamicFormService.patchFormValue(existingData);
        }, 100);
      } catch (error) {
      }
    } else {
    }
    
    this.showForm.set(true);
  }

  openViewForm(document: Schema['Document']['type']) {
    this.currentMode.set('view');
    this.selectedDocument.set(document);
    
    this.documentForm.patchValue({
      projectId: document.projectId,
      documentType: document.documentType
    });
    
    // Disable all form fields in view mode
    this.documentForm.disable();
    
    // Generate dynamic form for the document type
    this.onDocumentTypeChange(document.documentType);
    
    // Populate dynamic form with existing data if available
    const documentWithFormData = document as any;
    if (documentWithFormData.formData) {
      try {
        const existingData = JSON.parse(documentWithFormData.formData);
        setTimeout(() => {
          this.dynamicFormService.patchFormValue(existingData);
          // Disable dynamic form fields in view mode
          const dynamicForm = this.dynamicFormService.dynamicFormGroup();
          if (dynamicForm) {
            dynamicForm.disable();
          }
        }, 100);
      } catch (error) {
        console.error('Error parsing existing form data for view mode:', error);
      }
    }
    
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.currentMode.set('create');
    this.selectedDocument.set(null);
    this.documentForm.reset();
    this.documentForm.enable(); // Re-enable form for next use
    this.dynamicFormService.resetForm();
  }

  async onSubmitForm() {
    // Only validate forms in create mode
    if (this.currentMode() === 'create') {
      if (!this.documentForm.valid) return;
      if (!this.dynamicFormService.isFormValid()) {
        this.dynamicFormService.markAllFieldsAsTouched();
        return;
      }
    }

    this.processing.set(true);
    
    try {
      const formValue = this.documentForm.value;
      let dynamicFormValue = this.dynamicFormService.getFormValue();

      console.log(`💾 Saving document - Mode: ${this.currentMode()}`);
      console.log(`💾 Form value:`, formValue);
      console.log(`💾 Dynamic form value:`, dynamicFormValue);

      // Handle file uploads if there are any
      let uploadedFileUrls = {};
      if (this.currentMode() === 'create') {
        // For create mode, we need to create the document first to get an ID for file uploads
        const documentData = {
          projectId: formValue.projectId,
          documentType: formValue.documentType,
          formData: JSON.stringify(dynamicFormValue)
        };
        const newDocument = await this.createDocument(documentData as any);
        
        // Upload files after creating document
        if (Object.keys(this.dynamicFormService.fileObjects()).length > 0) {
          uploadedFileUrls = await this.dynamicFormService.uploadFilesForDocument(newDocument.id);
          // Update form data with file URLs
          dynamicFormValue = { ...dynamicFormValue, ...uploadedFileUrls };
          await this.updateDocument(newDocument.id, {
            formData: JSON.stringify(dynamicFormValue)
          } as any);
        }
      } else if (this.currentMode() === 'edit' && this.selectedDocument()) {
        // For edit mode, upload files first then update
        if (Object.keys(this.dynamicFormService.fileObjects()).length > 0) {
          uploadedFileUrls = await this.dynamicFormService.uploadFilesForDocument(this.selectedDocument()!.id);
          // Merge uploaded file URLs with existing form data
          dynamicFormValue = { ...dynamicFormValue, ...uploadedFileUrls };
        }
        
        console.log(`💾 Updating document ${this.selectedDocument()!.id} with formData:`, JSON.stringify(dynamicFormValue));
        
        await this.updateDocument(this.selectedDocument()!.id, {
          formData: JSON.stringify(dynamicFormValue),
          status: 'draft'
        } as any);
      }

      this.closeForm();
      await this.loadDocuments();
    } catch (error) {
    } finally {
      this.processing.set(false);
    }
  }

  async createDocument(document: Omit<Schema['Document']['type'], 'id' | 'version' | 'updatedAt'>): Promise<Schema['Document']['type']> {
    try {
      const result = await this.versionedDataService.createVersionedRecord('Document', {
        data: {
          ...document
        }
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create document');
      }
      
      return result.data;
    } catch (error) {
      throw error;
    }
  }


  async updateDocument(id: string, updates: Partial<Schema['Document']['type']>) {
    try {
      const result = await this.versionedDataService.updateVersionedRecord('Document', id, updates);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update document');
      }
    } catch (error) {
      throw error;
    }
  }


  getDocumentTypeName(documentTypeId: string): string {
    const docType = this.documentTypes().find(dt => dt.id === documentTypeId);
    if (!docType) {
    }
    return docType ? docType.name : 'Unknown Type';
  }

  getProjectName(projectId: string): string {
    const project = this.projects().find(p => p.id === projectId);
    if (!project) {
    }
    return project ? project.name : 'Unknown Project';
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
      } else {
      }
      
      // Also load workflow rules from project workflow (these will be merged with document type rules)
      this.loadWorkflowRulesForDocumentType(documentTypeId);
    } else {
      this.dynamicFormService.resetForm();
    }
  }

  private async loadWorkflowRulesForDocumentType(documentTypeId: string) {
    const projectId = this.documentForm.get('projectId')?.value;
    if (!projectId) return;
    
    const project = this.projects().find(p => p.id === projectId);
    if (!project?.workflowId) return;
    
    const documentTypeName = this.getDocumentTypeName(documentTypeId);
    await this.dynamicFormService.loadWorkflowRulesForDocumentType(
      documentTypeId, 
      documentTypeName, 
      this.workflows(), 
      project.workflowId
    );
  }


  async openDocumentChat(document: Schema['Document']['type']) {
    try {
      
      // Get the current user's ID for chat (using database User ID, not Cognito ID)
      const currentUserData = this.userDataService.getCurrentUserData();
      const currentChatUserId = currentUserData?.id;
      
      if (!currentChatUserId) {
        alert('Unable to create chat room - user not found. Please try logging in again.');
        return;
      }
      
      // Get document type name for better chat room title
      const documentTypeName = this.getDocumentTypeName(document.documentType);
      const projectName = this.getProjectName(document.projectId);
      
      // Create document chat room with current user
      const allParticipants = [currentChatUserId]
        .filter((id): id is string => id !== null && id !== undefined && id.trim() !== '') // Type-safe filter
        .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates
      
      
      // First check if a chat room already exists for this document
      let chatRoom = await this.chatService.findExistingDocumentChatRoom(document.id);
      
      if (chatRoom) {
        // Ensure current user is added as participant if not already included
        chatRoom = await this.chatService.ensureUserInChatRoom(chatRoom, allParticipants);
      } else {
        chatRoom = await this.chatService.createDocumentChatRoom({
          projectId: document.projectId,
          projectName: projectName,
          documentId: document.id,
          documentType: documentTypeName,
          roomType: 'document',
          title: `${documentTypeName} - ${projectName}`,
          description: `Discussion for ${documentTypeName} document in ${projectName}`,
          adminUsers: [], // Documents usually don't have admin users in chat
          providerUsers: allParticipants
        });
        
      }
      
      // Navigate to chat with the specific room
      this.router.navigate(['/chat'], { 
        queryParams: { 
          room: chatRoom.id,
          from: 'documents'
        } 
      });
      
    } catch (error) {
      alert(`Failed to create chat room: ${error}. Please try again.`);
    }
  }
}