import { Component, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-documents',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './documents.html',
  styleUrl: './documents.less'
})
export class Documents implements OnInit {
  documents = signal<Array<Schema['Document']['type']>>([]);
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  projects = signal<Array<Schema['Project']['type']>>([]);
  loading = signal(true);
  loadingDocumentTypes = signal(false);
  loadingProjects = signal(false);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedDocument = signal<Schema['Document']['type'] | null>(null);
  processing = signal(false);
  
  private fb = inject(FormBuilder);
  
  documentForm: FormGroup = this.fb.group({
    projectId: ['', [Validators.required]],
    documentType: ['', [Validators.required]],
    assignedProviders: [''],
    acceptedProvider: [''],
    status: ['requested', [Validators.required]],
    dueDate: ['']
  });

  async ngOnInit() {
    await Promise.all([
      this.loadDocuments(), 
      this.loadDocumentTypes(),
      this.loadProjects()
    ]);
  }

  async loadDocuments() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Document.list();
      this.documents.set(data);
    } catch (error) {
      console.error('Error loading documents:', error);
      this.documents.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadDocumentTypes() {
    try {
      this.loadingDocumentTypes.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.DocumentType.list();
      this.documentTypes.set(data);
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
    } finally {
      this.loadingDocumentTypes.set(false);
    }
  }

  async loadProjects() {
    try {
      this.loadingProjects.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Project.list();
      this.projects.set(data);
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects.set([]);
    } finally {
      this.loadingProjects.set(false);
    }
  }

  openCreateForm() {
    this.currentMode.set('create');
    this.selectedDocument.set(null);
    this.documentForm.reset();
    this.documentForm.patchValue({ status: 'requested' });
    this.showForm.set(true);
  }

  openEditForm(document: Schema['Document']['type']) {
    this.currentMode.set('edit');
    this.selectedDocument.set(document);
    
    const assignedProvidersString = document.assignedProviders ? document.assignedProviders.join(', ') : '';
    
    this.documentForm.patchValue({
      projectId: document.projectId,
      documentType: document.documentType,
      assignedProviders: assignedProvidersString,
      acceptedProvider: document.acceptedProvider || '',
      status: document.status || 'requested',
      dueDate: document.dueDate ? document.dueDate.split('T')[0] : ''
    });
    this.showForm.set(true);
  }

  openViewMode(document: Schema['Document']['type']) {
    this.currentMode.set('view');
    this.selectedDocument.set(document);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.currentMode.set('create');
    this.selectedDocument.set(null);
    this.documentForm.reset();
    this.documentForm.patchValue({ status: 'requested' });
  }

  async onSubmitForm() {
    if (!this.documentForm.valid) return;

    this.processing.set(true);
    
    try {
      const formValue = this.documentForm.value;
      const assignedProvidersArray = formValue.assignedProviders 
        ? formValue.assignedProviders.split(',').map((provider: string) => provider.trim()).filter((provider: string) => provider)
        : [];

      const documentData = {
        projectId: formValue.projectId,
        documentType: formValue.documentType,
        assignedProviders: assignedProvidersArray,
        acceptedProvider: formValue.acceptedProvider || undefined,
        status: formValue.status as 'requested' | 'accepted' | 'rejected' | 'provided',
        dueDate: formValue.dueDate ? new Date(formValue.dueDate).toISOString() : undefined
      };

      if (this.currentMode() === 'create') {
        await this.createDocument(documentData);
      } else if (this.currentMode() === 'edit' && this.selectedDocument()) {
        await this.updateDocument(this.selectedDocument()!.id, documentData);
      }

      this.closeForm();
      await this.loadDocuments();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.processing.set(false);
    }
  }

  async createDocument(document: Omit<Schema['Document']['type'], 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Document.create({
        ...document,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  async updateDocument(id: string, updates: Partial<Schema['Document']['type']>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Document.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  async deleteDocument(document: Schema['Document']['type']) {
    if (!confirm(`Are you sure you want to delete document for project "${this.getProjectName(document.projectId)}"?`)) return;

    this.processing.set(true);
    
    try {
      const client = generateClient<Schema>();
      await client.models.Document.delete({ id: document.id });
      await this.loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
    } finally {
      this.processing.set(false);
    }
  }

  getDocumentTypeName(documentTypeId: string): string {
    const docType = this.documentTypes().find(dt => dt.id === documentTypeId);
    return docType ? docType.name : 'Unknown Type';
  }

  getProjectName(projectId: string): string {
    const project = this.projects().find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  }
}