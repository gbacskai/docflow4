import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-types',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './document-types.html',
  styleUrl: './document-types.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentTypes implements OnInit, OnDestroy {
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  filteredDocumentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  docTypeSearchQuery = signal<string>('');
  loading = signal(true);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedDocumentType = signal<Schema['DocumentType']['type'] | null>(null);
  processing = signal(false);
  expandedDescriptions = signal<Set<string>>(new Set());
  
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  
  private fb = inject(FormBuilder);
  private docTypeSearchTimeout: any = null;
  
  documentTypeForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    identifier: ['', [Validators.minLength(2), this.identifierValidator.bind(this), this.uniqueIdentifierValidator.bind(this)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    isActive: [true, [Validators.required]]
  });

  // Custom validator for identifier field
  private identifierValidator(control: any) {
    const value = control.value;
    if (!value) return null; // Let required validator handle empty values
    
    // Check if it contains only lowercase letters, numbers, and hyphens/underscores
    const validPattern = /^[a-z0-9_-]+$/;
    if (!validPattern.test(value)) {
      return { invalidIdentifier: { message: 'Identifier must contain only lowercase letters, numbers, hyphens, and underscores' } };
    }
    
    // Check if it starts with a letter
    if (!/^[a-z]/.test(value)) {
      return { invalidIdentifier: { message: 'Identifier must start with a lowercase letter' } };
    }
    
    return null; // Valid
  }

  // Custom validator for unique identifier
  private uniqueIdentifierValidator(control: any) {
    const value = control.value;
    if (!value) return null; // Skip validation if empty
    
    const currentDocTypes = this.documentTypes();
    const currentEditingId = this.selectedDocumentType()?.id;
    
    // Check if identifier already exists (excluding current document type in edit mode)
    const isDuplicate = currentDocTypes.some(docType => 
      docType.identifier === value && docType.id !== currentEditingId
    );
    
    if (isDuplicate) {
      return { duplicateIdentifier: { message: 'This identifier is already in use. Please choose a different one.' } };
    }
    
    return null; // Valid
  }

  async ngOnInit() {
    await this.loadDocumentTypes();
    
    // Auto-generate identifier from name field
    this.documentTypeForm.get('name')?.valueChanges.subscribe(name => {
      if (name && this.currentMode() === 'create') {
        const identifier = this.generateIdentifier(name);
        this.documentTypeForm.get('identifier')?.setValue(identifier);
      }
    });

    // Trigger validation when identifier field changes
    this.documentTypeForm.get('identifier')?.valueChanges.subscribe(() => {
      // Small delay to ensure validation happens after value is set
      setTimeout(() => {
        this.documentTypeForm.get('identifier')?.updateValueAndValidity();
      }, 100);
    });
  }

  // Generate unique identifier from name
  private generateIdentifier(name: string): string {
    const baseIdentifier = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, '') // Remove special characters except spaces, hyphens, underscores
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^[^a-z]+/, '') // Remove leading non-letters
      .substring(0, 50); // Limit length
    
    // Check if this identifier already exists
    const existingIdentifiers = this.documentTypes()
      .map(docType => docType.identifier)
      .filter(id => id !== null && id !== undefined);
    
    let uniqueIdentifier = baseIdentifier;
    let counter = 1;
    
    // If identifier exists, append a number to make it unique
    while (existingIdentifiers.includes(uniqueIdentifier)) {
      const suffix = `_${counter}`;
      const maxLength = 50 - suffix.length;
      uniqueIdentifier = baseIdentifier.substring(0, maxLength) + suffix;
      counter++;
    }
    
    return uniqueIdentifier;
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.docTypeSearchTimeout) {
      clearTimeout(this.docTypeSearchTimeout);
    }
  }

  async loadDocumentTypes() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.DocumentType.list();
      this.documentTypes.set(data);
      this.applyDocTypeSearch(); // Initialize filtered document types
      
      // Trigger validation refresh for identifier uniqueness
      if (this.documentTypeForm.get('identifier')) {
        this.documentTypeForm.get('identifier')?.updateValueAndValidity();
      }
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
      this.filteredDocumentTypes.set([]);
    } finally {
      this.loading.set(false);
    }
  }


  openCreateForm() {
    this.currentMode.set('create');
    this.selectedDocumentType.set(null);
    this.documentTypeForm.reset();
    this.documentTypeForm.patchValue({ isActive: true });
    this.showForm.set(true);
  }

  openEditForm(docType: Schema['DocumentType']['type']) {
    this.currentMode.set('edit');
    this.selectedDocumentType.set(docType);
    
    // Generate identifier if it doesn't exist (for legacy records)
    const identifier = docType.identifier || this.generateIdentifier(docType.name || '');
    
    this.documentTypeForm.patchValue({
      name: docType.name,
      identifier: identifier,
      description: docType.description,
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
    this.documentTypeForm.patchValue({ isActive: true });
  }

  trackDocTypeById(index: number, docType: Schema['DocumentType']['type']): string {
    return docType?.id || index.toString();
  }

  private searchTimeout: any = null;

  async onSubmitForm() {
    if (!this.documentTypeForm.valid) return;

    this.processing.set(true);
    
    try {
      const formValue = this.documentTypeForm.value;

      const docTypeData = {
        name: formValue.name,
        identifier: formValue.identifier || this.generateIdentifier(formValue.name || ''),
        description: formValue.description,
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


  // Document Type Search functionality
  onDocTypeSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value.toLowerCase().trim();
    this.docTypeSearchQuery.set(query);
    
    if (this.docTypeSearchTimeout) {
      clearTimeout(this.docTypeSearchTimeout);
    }

    this.docTypeSearchTimeout = setTimeout(() => {
      this.applyDocTypeSearch();
    }, 300);
  }

  applyDocTypeSearch() {
    const query = this.docTypeSearchQuery();
    const allDocTypes = this.documentTypes().filter(docType => docType && docType.id);
    
    if (!query) {
      this.filteredDocumentTypes.set(allDocTypes);
    } else {
      const filtered = allDocTypes.filter(docType =>
        docType.name?.toLowerCase().includes(query) ||
        docType.description?.toLowerCase().includes(query)
      );
      this.filteredDocumentTypes.set(filtered);
    }
  }

  clearDocTypeSearch() {
    this.docTypeSearchQuery.set('');
    const allDocTypes = this.documentTypes().filter(docType => docType && docType.id);
    this.filteredDocumentTypes.set(allDocTypes);
  }


  // Description expansion methods
  toggleDescriptionExpansion(docTypeId: string) {
    const currentExpanded = this.expandedDescriptions();
    const newExpanded = new Set(currentExpanded);
    
    if (newExpanded.has(docTypeId)) {
      newExpanded.delete(docTypeId);
    } else {
      newExpanded.add(docTypeId);
    }
    
    this.expandedDescriptions.set(newExpanded);
  }

  isDescriptionExpanded(docTypeId: string): boolean {
    return this.expandedDescriptions().has(docTypeId);
  }

  getFirstLine(description: string): string {
    if (!description) return '';
    const firstLine = description.split('\n')[0];
    return firstLine.trim();
  }

  hasMultipleLines(description: string): boolean {
    if (!description) return false;
    return description.includes('\n') && description.split('\n').length > 1;
  }

}
