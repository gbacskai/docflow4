import { Component, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-types',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './document-types.html',
  styleUrl: './document-types.less'
})
export class DocumentTypes implements OnInit {
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  domains = signal<Array<Schema['Domain']['type']>>([]);
  loading = signal(true);
  loadingDomains = signal(false);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedDocumentType = signal<Schema['DocumentType']['type'] | null>(null);
  processing = signal(false);
  
  private fb = inject(FormBuilder);
  
  documentTypeForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    category: [[]], // Domain is optional - no validators required
    isActive: [true, [Validators.required]]
  });

  async ngOnInit() {
    await Promise.all([this.loadDocumentTypes(), this.loadDomains()]);
  }

  async loadDocumentTypes() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.DocumentType.list();
      this.documentTypes.set(data);
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadDomains() {
    try {
      this.loadingDomains.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Domain.list();
      this.domains.set(data);
    } catch (error) {
      console.error('Error loading domains:', error);
      this.domains.set([]);
    } finally {
      this.loadingDomains.set(false);
    }
  }

  openCreateForm() {
    this.currentMode.set('create');
    this.selectedDocumentType.set(null);
    this.documentTypeForm.reset();
    this.documentTypeForm.patchValue({ category: [], isActive: true });
    this.showForm.set(true);
  }

  openEditForm(docType: Schema['DocumentType']['type']) {
    this.currentMode.set('edit');
    this.selectedDocumentType.set(docType);
    
    // Parse category string (comma-separated domain IDs) into array
    let categoryArray: string[] = [];
    if (docType.category) {
      if (Array.isArray(docType.category)) {
        categoryArray = docType.category;
      } else if (typeof docType.category === 'string') {
        categoryArray = docType.category.includes(',') 
          ? docType.category.split(',').map(c => c.trim()).filter(c => c)
          : [docType.category];
      }
    }
    
    console.log('Opening edit form with category:', docType.category, 'parsed as:', categoryArray);
    
    this.documentTypeForm.patchValue({
      name: docType.name,
      description: docType.description,
      category: categoryArray,
      isActive: docType.isActive ?? true
    });
    this.showForm.set(true);
  }

  openViewMode(docType: Schema['DocumentType']['type']) {
    this.currentMode.set('view');
    this.selectedDocumentType.set(docType);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.currentMode.set('create');
    this.selectedDocumentType.set(null);
    this.documentTypeForm.reset();
    this.documentTypeForm.patchValue({ category: [], isActive: true });
  }

  async onSubmitForm() {
    if (!this.documentTypeForm.valid) return;

    this.processing.set(true);
    
    try {
      const formValue = this.documentTypeForm.value;

      // Convert category array to appropriate format for the schema
      let categoryValue = formValue.category;
      if (Array.isArray(categoryValue)) {
        // If multiple domains, join them or take the first one
        // Based on schema, category is a string, so we'll join multiple domains with commas
        categoryValue = categoryValue.length > 0 ? categoryValue.join(',') : '';
      }

      const docTypeData = {
        name: formValue.name,
        description: formValue.description,
        category: categoryValue,
        isActive: formValue.isActive
      };

      console.log('Submitting document type data:', docTypeData);

      if (this.currentMode() === 'create') {
        await this.createDocumentType(docTypeData);
      } else if (this.currentMode() === 'edit' && this.selectedDocumentType()) {
        await this.updateDocumentType(this.selectedDocumentType()!.id, docTypeData);
      }

      this.closeForm();
      await this.loadDocumentTypes();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.processing.set(false);
    }
  }

  async createDocumentType(docType: Omit<Schema['DocumentType']['type'], 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'templateCount' | 'fields'>) {
    try {
      const client = generateClient<Schema>();
      await client.models.DocumentType.create({
        ...docType,
        fields: [],
        usageCount: 0,
        templateCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating document type:', error);
      throw error;
    }
  }

  async updateDocumentType(id: string, updates: Partial<Schema['DocumentType']['type']>) {
    try {
      const client = generateClient<Schema>();
      await client.models.DocumentType.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating document type:', error);
      throw error;
    }
  }

  async deleteDocumentType(docType: Schema['DocumentType']['type']) {
    if (!confirm(`Are you sure you want to delete "${docType.name}"?`)) return;

    this.processing.set(true);
    
    try {
      const client = generateClient<Schema>();
      await client.models.DocumentType.delete({ id: docType.id });
      await this.loadDocumentTypes();
    } catch (error) {
      console.error('Error deleting document type:', error);
    } finally {
      this.processing.set(false);
    }
  }

  getDomainName(domainId: string): string {
    const domain = this.domains().find(d => d.id === domainId);
    return domain ? domain.name : 'Unknown Domain';
  }

  getDomainNames(domainIds: string | string[]): string {
    if (!domainIds) return 'No domains assigned';
    
    let ids: string[] = [];
    if (Array.isArray(domainIds)) {
      ids = domainIds;
    } else if (typeof domainIds === 'string') {
      // Handle comma-separated string
      ids = domainIds.includes(',') 
        ? domainIds.split(',').map(id => id.trim()).filter(id => id)
        : [domainIds];
    }
    
    if (ids.length === 0) return 'No domains assigned';
    
    const names = ids.map(id => this.getDomainName(id));
    return names.join(', ');
  }

  toggleDomain(domainId: string, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const currentDomains = this.documentTypeForm.get('category')?.value || [];
    
    if (checkbox.checked) {
      if (!currentDomains.includes(domainId)) {
        this.documentTypeForm.patchValue({
          category: [...currentDomains, domainId]
        });
      }
    } else {
      this.documentTypeForm.patchValue({
        category: currentDomains.filter((id: string) => id !== domainId)
      });
    }
  }

  isDomainSelected(domainId: string): boolean {
    const currentDomains = this.documentTypeForm.get('category')?.value || [];
    return currentDomains.includes(domainId);
  }
}
