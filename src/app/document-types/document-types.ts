import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';
import { debounceTime } from 'rxjs/operators';
import { DynamicFormService } from '../services/dynamic-form.service';
import { VersionedDataService } from '../services/versioned-data.service';
import { DynamicFormComponent } from '../shared/dynamic-form.component';

@Component({
  selector: 'app-document-types',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DynamicFormComponent],
  templateUrl: './document-types.html',
  styleUrl: './document-types.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentTypes implements OnInit, OnDestroy {
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  workflows = signal<Array<Schema['Workflow']['type']>>([]);
  filteredDocumentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  docTypeSearchQuery = signal<string>('');
  showAllItems = signal<boolean>(false); // Default to show only active items
  loading = signal(true);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedDocumentType = signal<Schema['DocumentType']['type'] | null>(null);
  editingInlineId = signal<string | null>(null); // Track which item is being edited inline
  processing = signal(false);
  expandedDescriptions = signal<Set<string>>(new Set());
  
  definitionTimeout: any = null;
  
  // Test mode signals
  isTestMode = signal<boolean>(false);
  formTestData = signal<string | null>(null);
  
  // AI Translation signals
  definitionInWords = signal<string>('');
  isTranslating = signal<boolean>(false);
  
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  dynamicFormService = inject(DynamicFormService);
  private versionedDataService = inject(VersionedDataService);
  private docTypeSearchTimeout: any = null;
  private validationTimeout: any = null;
  private identifierValidationTimeout: any = null;

  // Expose service signals to template
  get dynamicFormFields() { return this.dynamicFormService.dynamicFormFields; }
  get dynamicFormGroup() { return this.dynamicFormService.dynamicFormGroup; }
  get validationResults() { return this.dynamicFormService.validationResults; }
  get validationHasErrors() { return this.dynamicFormService.validationHasErrors; }
  get workflowRules() { return this.dynamicFormService.workflowRules; }
  get uploadedFiles() { return this.dynamicFormService.uploadedFiles; }
  get arrayFieldData() { return this.dynamicFormService.arrayFieldData; }

  // Expose service method to template
  evaluateValidationRules() {
    this.dynamicFormService.evaluateValidationRules();
  }

  // Helper methods needed by AI translation functionality
  private inferFieldType(description: string, fieldName: string): string {
    const text = (description + ' ' + fieldName).toLowerCase();
    
    if (text.includes('email')) return 'email';
    if (text.includes('password')) return 'password';
    if (text.includes('phone') || text.includes('tel')) return 'tel';
    if (text.includes('url') || text.includes('website') || text.includes('link')) return 'url';
    if (text.includes('date') || text.includes('time') || text.includes('birthday')) return 'date';
    if (text.includes('number') || text.includes('amount') || text.includes('price') || text.includes('cost')) return 'number';
    if (text.includes('text') || text.includes('description') || text.includes('comment') || text.includes('note')) return 'textarea';
    if (text.includes('select') || text.includes('choose') || text.includes('option')) return 'select';
    if (text.includes('checkbox') || text.includes('agree') || text.includes('accept')) return 'checkbox';
    if (text.includes('file') || text.includes('upload') || text.includes('document') || text.includes('attachment') || text.includes('certificate') || text.includes('plan')) return 'file';
    
    return 'text';
  }

  // Generate field key from field name
  private generateFieldKey(fieldName: string): string {
    return fieldName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  // Simple condition evaluation for workflow field visibility
  private evaluateSingleCondition(condition: string, formGroup: any, arrayData: any): boolean {
    // Handle field value conditions like "status == 'waiting'" or "notrequired == true"
    const fieldValueMatch = condition.match(/(\w+)\s*([><=!]+)\s*['"]?([^'"]+)['"]?/);
    if (fieldValueMatch) {
      const [, fieldKey, operator, expectedValue] = fieldValueMatch;
      let actualValue = formGroup?.get(fieldKey)?.value;
      
      // Handle boolean values for checkboxes
      if (expectedValue === 'true' || expectedValue === 'false') {
        actualValue = actualValue === true ? 'true' : 'false';
      } else {
        actualValue = actualValue || '';
      }
      
      switch (operator) {
        case '==': case '=': return actualValue === expectedValue;
        case '!=': return actualValue !== expectedValue;
        default: throw new Error(`Unsupported operator for field values: ${operator}`);
      }
    }

    // If we can't parse it, return false to be safe
    return false;
  }
  
  // Custom validator for unique identifier  
  private uniqueIdentifierValidator = async (control: any) => {
    const value = control.value;
    if (!value || value.length < 2) {
      return null; // Skip validation if empty or too short
    }
    
    
    const currentEditingId = this.selectedDocumentType()?.id;
    
    // First check against locally loaded document types to avoid unnecessary API calls
    const existingDocTypes = this.documentTypes();
    const localDuplicate = existingDocTypes.find(docType => 
      docType && docType.identifier === value && docType.id !== currentEditingId
    );
    
    if (localDuplicate) {
      return { duplicateIdentifier: { message: 'This identifier is already in use. Please choose a different one.' } };
    }
    
    // Only make API call if not found locally (for freshly created items not yet in local list)
    try {
      const result = await this.versionedDataService.getAllLatestVersions('DocumentType');
      
      if (!result.success || !result.data) {
        return null; // Allow on error to avoid blocking user
      }
      
      // Check if identifier exists (excluding current document in edit mode)
      const existingDoc = result.data.find(docType => 
        docType && docType.identifier === value && docType.id !== currentEditingId
      );
      
      if (existingDoc) {
        return { duplicateIdentifier: { message: 'This identifier is already in use. Please choose a different one.' } };
      } else {
        return null; // Valid
      }
    } catch (error) {
      console.error('Error checking identifier uniqueness:', error);
      return null; // Allow on error to avoid blocking user
    }
  };
  
  documentTypeForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    identifier: ['', [Validators.minLength(2), this.identifierValidator.bind(this)]],
    definition: [`{
  "fields": [
    {"key": "applicantName", "type": "text", "label": "Full Name", "required": true, "placeholder": "Enter your full name"},
    {"key": "email", "type": "email", "label": "Email Address", "required": true, "placeholder": "Enter your email"},
    {"key": "phone", "type": "tel", "label": "Phone Number", "placeholder": "(555) 123-4567"},
    {"key": "dateOfBirth", "type": "date", "label": "Date of Birth"},
    {"key": "propertyAddress", "type": "text", "label": "Property Address", "required": true, "description": "Full address of the property"},
    {"key": "projectType", "type": "select", "label": "Project Type", "required": true, "options": [
      {"value": "new_construction", "label": "New Construction"},
      {"value": "renovation", "label": "Renovation"},
      {"value": "addition", "label": "Addition"}
    ]},
    {"key": "estimatedCost", "type": "number", "label": "Estimated Project Cost", "placeholder": "$0.00", "description": "Total estimated cost in USD"},
    {"key": "hasContractor", "type": "checkbox", "label": "I have a licensed contractor", "placeholder": "Check if you have hired a contractor"},
    {"key": "projectDescription", "type": "textarea", "label": "Project Description", "required": true, "placeholder": "Describe your project in detail", "description": "Provide detailed description of the work to be performed"}
  ]
}`, [Validators.required, Validators.minLength(10)]],
    validationRules: [''],
    isActive: [true, [Validators.required]]
  });

  // Custom validator for identifier field
  private identifierValidator(control: any) {
    const value = control.value;
    if (!value) return null; // Let required validator handle empty values
    
    // Check if it contains only letters and numbers (PascalCase)
    const validPattern = /^[a-zA-Z0-9]+$/;
    if (!validPattern.test(value)) {
      return { invalidIdentifier: { message: 'Identifier must contain only letters and numbers (no spaces or special characters)' } };
    }
    
    // Check if it starts with a letter
    if (!/^[a-zA-Z]/.test(value)) {
      return { invalidIdentifier: { message: 'Identifier must start with a letter' } };
    }
    
    return null; // Valid
  }

  async ngOnInit() {
    await Promise.all([
      this.loadDocumentTypes(),
      this.loadWorkflows()
    ]);
    
    // Auto-generate identifier from name field
    this.documentTypeForm.get('name')?.valueChanges.subscribe(name => {
      if (name && this.currentMode() === 'create') {
        const identifier = this.generateIdentifier(name);
        this.documentTypeForm.get('identifier')?.setValue(identifier);
      }
    });

    // Trigger validation when identifier field changes (with debouncing)
    this.documentTypeForm.get('identifier')?.valueChanges.subscribe(() => {
      // Clear previous timeout to debounce validation calls
      if (this.identifierValidationTimeout) {
        clearTimeout(this.identifierValidationTimeout);
      }
      
      // Only validate if we're not in the middle of form initialization
      this.identifierValidationTimeout = setTimeout(() => {
        const identifierControl = this.documentTypeForm.get('identifier');
        if (identifierControl && identifierControl.value) {
          identifierControl.updateValueAndValidity();
        }
      }, 500); // Increased delay to reduce API calls
    });

    // Watch definition field changes to generate dynamic form
    this.documentTypeForm.get('definition')?.valueChanges.subscribe(definition => {
      this.onDefinitionChange(definition);
    });
    
    // Watch validation rules changes to reload workflow rules
    this.documentTypeForm.get('validationRules')?.valueChanges.subscribe((value) => {
      console.log('Validation rules field changed to:', value);
      this.loadWorkflowRules();
    });
  }

  // Generate unique identifier from name
  private generateIdentifier(name: string): string {
    const baseIdentifier = name
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters except spaces
      .split(/\s+/) // Split by whitespace
      .filter(word => word.length > 0) // Remove empty strings
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter
      .join('') // Join without spaces
      .substring(0, 50); // Limit length
    
    // Check if this identifier already exists
    const existingIdentifiers = this.documentTypes()
      .filter(docType => docType && docType.identifier)
      .map(docType => docType.identifier)
      .filter(id => id !== null && id !== undefined);
    
    let uniqueIdentifier = baseIdentifier;
    let counter = 1;
    
    // If identifier exists, append a number to make it unique
    while (existingIdentifiers.includes(uniqueIdentifier)) {
      const suffix = `${counter}`;
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
    if (this.definitionTimeout) {
      clearTimeout(this.definitionTimeout);
    }
    if (this.validationTimeout) {
      clearTimeout(this.validationTimeout);
    }
    if (this.identifierValidationTimeout) {
      clearTimeout(this.identifierValidationTimeout);
    }
  }

  async loadDocumentTypes() {
    try {
      this.loading.set(true);
      const result = await this.versionedDataService.getAllLatestVersions('DocumentType');
      if (result.success && result.data) {
        this.documentTypes.set(result.data);
      } else {
        console.error('Error loading document types:', result.error);
        this.documentTypes.set([]);
      }
      this.applyDocTypeSearch(); // Initialize filtered document types
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
      this.filteredDocumentTypes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadWorkflows() {
    try {
      const result = await this.versionedDataService.getAllLatestVersions('Workflow');
      if (result.success && result.data) {
        this.workflows.set(result.data);
      } else {
        console.error('Error loading workflows:', result.error);
        this.workflows.set([]);
      }
    } catch (error) {
      console.error('Error loading workflows:', error);
      this.workflows.set([]);
    }
  }

  getWorkflowCount(documentType: Schema['DocumentType']['type']): number {
    if (!documentType.identifier) return 0;
    
    let count = 0;
    
    this.workflows().forEach(workflow => {
      if (!workflow.rules) return;
      
      let workflowUsesDocType = false;
      
      workflow.rules.forEach((ruleString: any) => {
        try {
          const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
          const validation = rule.validation || '';
          const action = rule.action || '';
          
          // Check if this document type identifier appears in validation or action
          const searchText = `${validation} ${action}`.toLowerCase();
          if (searchText.includes(documentType.identifier!.toLowerCase())) {
            workflowUsesDocType = true;
          }
        } catch (error) {
          // Skip invalid rule JSON
        }
      });
      
      // Only count the workflow once, even if it uses the document type in multiple rules
      if (workflowUsesDocType) {
        count++;
      }
    });
    
    return count;
  }


  openCreateForm() {
    this.currentMode.set('create');
    this.selectedDocumentType.set(null);
    this.documentTypeForm.reset();
    this.documentTypeForm.patchValue({ isActive: true });
    this.showForm.set(true);
  }

  openEditForm(docType: Schema['DocumentType']['type']) {
    // Check if we're already editing this same document type
    if (this.editingInlineId() === docType.id) {
      // Already editing this item, no need to do anything
      return;
    }
    
    // Close any existing inline edit first
    if (this.editingInlineId()) {
      this.cancelInlineEdit();
    }
    
    // Set up the new inline edit immediately
    this.editingInlineId.set(docType.id);
    this.currentMode.set('edit');
    this.selectedDocumentType.set(docType);
    this.isTestMode.set(true); // Always enable test mode for inline edit
    this.formTestData.set(null);
    
    // Clear any pending timeouts
    if (this.identifierValidationTimeout) {
      clearTimeout(this.identifierValidationTimeout);
    }
    
    // Generate identifier if it doesn't exist
    const identifier = docType.identifier || this.generateIdentifier(docType.name || '');
    
    // Patch form values without triggering validation
    this.documentTypeForm.patchValue({
      name: docType.name,
      identifier: identifier,
      definition: docType.definition,
      validationRules: (docType as any).validationRules || '',
      isActive: docType.isActive ?? true
    }, { emitEvent: false });
    
    // Generate dynamic form immediately
    const definition = this.documentTypeForm.get('definition')?.value;
    if (definition) {
      this.dynamicFormService.generateDynamicFormSchema(definition);
      console.log('✅ Dynamic form regenerated for:', docType.name);
    }
    
    // Load workflow rules
    this.loadWorkflowRules();
  }

  cancelInlineEdit() {
    this.editingInlineId.set(null);
    this.selectedDocumentType.set(null);
    this.currentMode.set('create');
    this.isTestMode.set(false);
    this.formTestData.set(null);
    this.dynamicFormService.resetForm();
  }

  openViewMode(docType: Schema['DocumentType']['type']) {
    this.currentMode.set('view');
    this.selectedDocumentType.set(docType);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingInlineId.set(null);
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
    // Allow submission even if form validation fails (to enable testing)

    this.processing.set(true);
    
    try {
      const formValue = this.documentTypeForm.value;
      console.log('Form value:', formValue);
      console.log('Form valid:', this.documentTypeForm.valid);
      console.log('Current mode:', this.currentMode());

      const docTypeData = {
        name: formValue.name,
        identifier: formValue.identifier || this.generateIdentifier(formValue.name || ''),
        definition: formValue.definition,
        validationRules: formValue.validationRules || '',
        isActive: formValue.isActive
      };

      console.log('Submitting document type data:', docTypeData);

      if (this.currentMode() === 'create') {
        await this.createDocumentType(docTypeData as any);
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

  async createDocumentType(docType: Omit<Schema['DocumentType']['type'], 'id' | 'version' | 'updatedAt' | 'usageCount' | 'templateCount' | 'fields'>) {
    try {
      // Check uniqueness before creating - use API call for accurate check
      const checkResult = await this.versionedDataService.getAllLatestVersions('DocumentType');
      if (checkResult.success && checkResult.data) {
        const isDuplicate = checkResult.data.some(existing => 
          existing && existing.identifier === docType.identifier
        );
        
        if (isDuplicate) {
          throw new Error(`A document type with identifier "${docType.identifier}" already exists`);
        }
      }

      const result = await this.versionedDataService.createVersionedRecord('DocumentType', {
        data: {
          ...docType,
          fields: [],
          usageCount: 0,
        }
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create document type');
      }
    } catch (error) {
      console.error('Error creating document type:', error);
      throw error;
    }
  }

  async updateDocumentType(id: string, updates: Partial<Schema['DocumentType']['type']>) {
    try {
      // Check uniqueness before updating (if identifier is being changed)
      if (updates.identifier) {
        const checkResult = await this.versionedDataService.getAllLatestVersions('DocumentType');
        if (checkResult.success && checkResult.data) {
          const isDuplicate = checkResult.data.some(existing => 
            existing && existing.identifier === updates.identifier && existing.id !== id
          );
          
          if (isDuplicate) {
            throw new Error(`A document type with identifier "${updates.identifier}" already exists`);
          }
        }
      }

      const result = await this.versionedDataService.updateVersionedRecord('DocumentType', id, updates);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update document type');
      }
    } catch (error) {
      console.error('Error updating document type:', error);
      throw error;
    }
  }

  async archiveDocumentType(docType: Schema['DocumentType']['type']) {
    if (!confirm(`Are you sure you want to archive "${docType.name}"?`)) return;

    this.processing.set(true);
    
    try {
      const result = await this.versionedDataService.updateVersionedRecord('DocumentType', docType.id, {
        isActive: false // Set to inactive when archived
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to archive document type');
      }
      
      await this.loadDocumentTypes();
    } catch (error) {
      console.error('Error archiving document type:', error);
    } finally {
      this.processing.set(false);
    }
  }

  async activateDocumentType(docType: Schema['DocumentType']['type']) {
    if (!confirm(`Are you sure you want to activate "${docType.name}"?`)) return;

    this.processing.set(true);
    
    try {
      const result = await this.versionedDataService.updateVersionedRecord('DocumentType', docType.id, {
        isActive: true // Set to active when restored
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to activate document type');
      }
      
      await this.loadDocumentTypes();
    } catch (error) {
      console.error('Error activating document type:', error);
    } finally {
      this.processing.set(false);
    }
  }

  cloneDocumentType(docType: Schema['DocumentType']['type']) {
    // Open create form with cloned data
    this.currentMode.set('create');
    this.selectedDocumentType.set(null);
    this.documentTypeForm.reset();
    
    // Pre-fill form with cloned data (but generate new identifier)
    const clonedName = `${docType.name} (Copy)`;
    const clonedIdentifier = this.generateIdentifier(clonedName);
    
    this.documentTypeForm.patchValue({
      name: clonedName,
      identifier: clonedIdentifier,
      definition: docType.definition,
      validationRules: docType.validationRules,
      category: docType.category,
      fields: docType.fields,
      isActive: true // Default to active for clones
    });
    
    // Regenerate form if definition exists
    if (docType.definition) {
      this.dynamicFormService.generateDynamicFormSchema(docType.definition);
    }
    
    this.showForm.set(true);
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
    const showAll = this.showAllItems();
    let allDocTypes = this.documentTypes().filter(docType => docType && docType.id);
    
    // Filter by active status first (unless showing all)
    if (!showAll) {
      allDocTypes = allDocTypes.filter(docType => docType.isActive !== false);
    }
    
    if (!query) {
      this.filteredDocumentTypes.set(allDocTypes);
    } else {
      const filtered = allDocTypes.filter(docType =>
        docType.name?.toLowerCase().includes(query) ||
        docType.definition?.toLowerCase().includes(query)
      );
      this.filteredDocumentTypes.set(filtered);
    }
  }

  clearDocTypeSearch() {
    this.docTypeSearchQuery.set('');
    this.applyDocTypeSearch(); // Use the same filtering logic
  }

  toggleShowAllItems() {
    this.showAllItems.set(!this.showAllItems());
    this.applyDocTypeSearch(); // Re-apply filters with new setting
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

  getFirstLine(definition: string): string {
    if (!definition) return '';
    const firstLine = definition.split('\n')[0];
    return firstLine.trim();
  }

  hasMultipleLines(definition: string): boolean {
    if (!definition) return false;
    return definition.includes('\n') && definition.split('\n').length > 1;
  }

  // Handle definition changes to generate dynamic form
  onDefinitionChange(definition: string) {
    if (this.definitionTimeout) {
      clearTimeout(this.definitionTimeout);
    }

    this.definitionTimeout = setTimeout(() => {
      // Clear array data when definition changes
      this.dynamicFormService.arrayFieldData.set({});
      this.dynamicFormService.generateDynamicFormSchema(definition);
    }, 500); // 500ms delay to avoid excessive updates while typing
  }








  // Example form definitions
  loadExampleDefinition(exampleType: string) {
    let definition = '';
    
    switch (exampleType) {
      case 'BuildingPermit':
        definition = `{
  "fields": [
    {"key": "applicantName", "type": "text", "label": "Applicant Full Name", "required": true, "placeholder": "Enter your full name"},
    {"key": "propertyAddress", "type": "text", "label": "Property Address", "required": true, "description": "Full address where work will be performed"},
    {"key": "projectType", "type": "select", "label": "Project Type", "required": true, "options": [
      {"value": "new_construction", "label": "New Construction"},
      {"value": "renovation", "label": "Renovation"},
      {"value": "addition", "label": "Addition"},
      {"value": "demolition", "label": "Demolition"}
    ]},
    {"key": "estimatedCost", "type": "number", "label": "Estimated Project Cost", "placeholder": "$0.00", "description": "Total estimated cost in USD"},
    {"key": "contractorLicense", "type": "text", "label": "Contractor License Number", "placeholder": "License #"},
    {"key": "startDate", "type": "date", "label": "Planned Start Date", "required": true},
    {"key": "buildingPlans", "type": "file", "label": "Building Plans", "required": true, "description": "Upload architectural drawings and plans (PDF, JPG, PNG)", "accept": ".pdf,.jpg,.jpeg,.png"},
    {"key": "projectPhotos", "type": "file", "label": "Project Site Photos", "description": "Upload current photos of the project site", "accept": ".jpg,.jpeg,.png", "multiple": true},
    {"key": "contractorInsurance", "type": "file", "label": "Contractor Insurance Certificate", "description": "Upload proof of contractor insurance", "accept": ".pdf"},
    {"key": "projectDescription", "type": "textarea", "label": "Project Description", "required": true, "placeholder": "Detailed description of work to be performed"}
  ]
}`;
        break;
        
      case 'business_license':
        definition = `{
  "fields": [
    {"key": "businessName", "type": "text", "label": "Business Name", "required": true, "placeholder": "Enter business name"},
    {"key": "ownerName", "type": "text", "label": "Owner Full Name", "required": true, "placeholder": "Enter owner's full name"},
    {"key": "email", "type": "email", "label": "Contact Email", "required": true, "placeholder": "business@example.com"},
    {"key": "phone", "type": "tel", "label": "Phone Number", "required": true, "placeholder": "(555) 123-4567"},
    {"key": "businessAddress", "type": "text", "label": "Business Address", "required": true, "description": "Physical location of business"},
    {"key": "businessType", "type": "select", "label": "Business Type", "required": true, "defaultValue": "retail", "options": [
      {"value": "retail", "label": "Retail"},
      {"value": "restaurant", "label": "Restaurant/Food Service"},
      {"value": "professional", "label": "Professional Services"},
      {"value": "manufacturing", "label": "Manufacturing"},
      {"value": "other", "label": "Other"}
    ]},
    {"key": "employeeCount", "type": "number", "label": "Number of Employees", "placeholder": "0"},
    {"key": "businessLicense", "type": "file", "label": "Business License Document", "required": true, "description": "Upload copy of business license", "accept": ".pdf,.jpg,.jpeg,.png"},
    {"key": "businessPhotos", "type": "file", "label": "Business Photos", "description": "Upload photos of your business premises", "accept": ".jpg,.jpeg,.png", "multiple": true},
    {"key": "federalTaxId", "type": "text", "label": "Federal Tax ID (EIN)", "placeholder": "XX-XXXXXXX"}
  ]
}`;
        break;
        
      case 'event_permit':
        definition = `{
  "fields": [
    {"key": "eventName", "type": "text", "label": "Event Name", "required": true, "placeholder": "Enter event name"},
    {"key": "organizerName", "type": "text", "label": "Event Organizer", "required": true, "placeholder": "Enter organizer name"},
    {"key": "contactEmail", "type": "email", "label": "Contact Email", "required": true, "placeholder": "organizer@example.com"},
    {"key": "eventDate", "type": "date", "label": "Event Date", "required": true},
    {"key": "eventLocation", "type": "text", "label": "Event Location", "required": true, "description": "Venue or address where event will take place"},
    {"key": "expectedAttendees", "type": "number", "label": "Expected Attendees", "required": true, "placeholder": "0"},
    {"key": "eventFloorPlan", "type": "file", "label": "Event Floor Plan", "description": "Upload venue layout and seating arrangement", "accept": ".pdf,.jpg,.jpeg,.png"},
    {"key": "eventDocuments", "type": "file", "label": "Supporting Documents", "description": "Upload permits, contracts, or other event documents", "accept": ".pdf,.doc,.docx,.jpg,.jpeg,.png", "multiple": true},
    {"key": "hasAlcohol", "type": "checkbox", "label": "Alcohol will be served", "placeholder": "Check if alcohol will be served"},
    {"key": "hasLiveMusic", "type": "checkbox", "label": "Live music or amplified sound", "placeholder": "Check if there will be live music"},
    {"key": "eventDescription", "type": "textarea", "label": "Event Description", "required": true, "placeholder": "Describe the nature and activities of the event"}
  ]
}`;
        break;
        
      case 'health_inspection':
        definition = `{
  "fields": [
    {"key": "facilityName", "type": "text", "label": "Facility Name", "required": true, "placeholder": "Enter facility name"},
    {"key": "facilityType", "type": "select", "label": "Facility Type", "required": true, "options": [
      {"value": "restaurant", "label": "Restaurant"},
      {"value": "grocery", "label": "Grocery Store"},
      {"value": "daycare", "label": "Daycare/Childcare"},
      {"value": "school", "label": "School"},
      {"value": "healthcare", "label": "Healthcare Facility"}
    ]},
    {"key": "managerName", "type": "text", "label": "Manager Name", "required": true, "placeholder": "Enter manager's full name"},
    {"key": "facilityAddress", "type": "text", "label": "Facility Address", "required": true, "description": "Complete address of facility"},
    {"key": "operatingHours", "type": "text", "label": "Operating Hours", "placeholder": "e.g., Mon-Fri 9AM-5PM"},
    {"key": "employeeCount", "type": "number", "label": "Number of Employees", "placeholder": "0"},
    {"key": "lastInspectionDate", "type": "date", "label": "Last Inspection Date"},
    {"key": "healthCertificates", "type": "file", "label": "Health Certificates", "description": "Upload current health department certificates", "accept": ".pdf,.jpg,.jpeg,.png"},
    {"key": "specialRequirements", "type": "textarea", "label": "Special Requirements", "placeholder": "Any special health requirements or concerns"}
  ]
}`;
        break;
        
      case 'simple_form':
        definition = `{
  "fields": [
    {"key": "applicantName", "type": "text", "label": "Full Name", "required": true, "placeholder": "Enter your full name"},
    {"key": "email", "type": "email", "label": "Email Address", "required": true, "placeholder": "Enter your email"},
    {"key": "phone", "type": "tel", "label": "Phone Number", "placeholder": "(555) 123-4567"},
    {"key": "address", "type": "textarea", "label": "Mailing Address", "placeholder": "Enter your full address", "rows": 3},
    {"key": "applicationId", "type": "text", "label": "Application ID", "defaultValue": "APP-2024-001", "disabled": true, "description": "Auto-generated application ID (cannot be modified)"},
    {"key": "dateOfBirth", "type": "date", "label": "Date of Birth"},
    {"key": "submissionDate", "type": "date", "label": "Submission Date", "defaultValue": "2024-08-31", "disabled": true, "description": "Automatically set to today's date"},
    {"key": "comments", "type": "textarea", "label": "Additional Comments", "placeholder": "Any additional notes or comments", "rows": 4}
  ]
}`;
        break;
        
      case 'invoice_form':
        definition = `{
  "fields": [
    {"key": "invoiceNumber", "type": "text", "label": "Invoice Number", "required": true, "placeholder": "INV-001"},
    {"key": "invoiceDate", "type": "date", "label": "Invoice Date", "required": true},
    {"key": "dueDate", "type": "date", "label": "Due Date", "required": true},
    {"key": "clientName", "type": "text", "label": "Client Name", "required": true, "placeholder": "Enter client name"},
    {"key": "clientEmail", "type": "email", "label": "Client Email", "required": true, "placeholder": "client@example.com"},
    {"key": "clientAddress", "type": "textarea", "label": "Client Address", "required": true, "placeholder": "Enter full billing address"},
    {"key": "lineItems", "type": "array", "label": "Invoice Items", "required": true, "description": "Add multiple line items for products or services", "itemSchema": {
      "description": {"type": "text", "label": "Description", "required": true, "placeholder": "Product or service description"},
      "quantity": {"type": "number", "label": "Quantity", "required": true, "placeholder": "1", "min": 1},
      "unitPrice": {"type": "number", "label": "Unit Price", "required": true, "placeholder": "0.00", "step": "0.01"},
      "total": {"type": "number", "label": "Total", "readonly": true, "calculated": "quantity * unitPrice"}
    }},
    {"key": "subtotal", "type": "number", "label": "Subtotal", "readonly": true, "calculated": "sum of all line item totals"},
    {"key": "taxRate", "type": "number", "label": "Tax Rate (%)", "placeholder": "0.00", "step": "0.01", "max": 100},
    {"key": "taxAmount", "type": "number", "label": "Tax Amount", "readonly": true, "calculated": "subtotal * (taxRate / 100)"},
    {"key": "totalAmount", "type": "number", "label": "Total Amount", "readonly": true, "calculated": "subtotal + taxAmount"},
    {"key": "notes", "type": "textarea", "label": "Notes", "placeholder": "Payment terms, special instructions, etc.", "rows": 3},
    {"key": "attachments", "type": "file", "label": "Attachments", "description": "Upload supporting documents", "accept": ".pdf,.jpg,.jpeg,.png", "multiple": true}
  ]
}`;
        break;
    }
    
    this.documentTypeForm.patchValue({ definition });
    this.dynamicFormService.generateDynamicFormSchema(definition);
  }

  // Test mode functionality
  toggleFormTestMode() {
    this.isTestMode.set(!this.isTestMode());
    this.formTestData.set(null);
    
    if (!this.isTestMode()) {
      // Clear form when exiting test mode
      this.clearTestForm();
      this.dynamicFormService.uploadedFiles.set({});
      this.dynamicFormService.arrayFieldData.set({});
      this.dynamicFormService.validationResults.set([]);
      this.dynamicFormService.validationHasErrors.set(false);
    } else {
      // Load workflow rules first, then run initial validation when entering test mode
      this.loadWorkflowRules();
      setTimeout(() => this.dynamicFormService.evaluateValidationRules(), 100);
    }
  }

  private setupFormChangeListeners() {
    // This will be called whenever the form is recreated
    const formGroup = this.dynamicFormService.dynamicFormGroup();
    if (formGroup) {
      console.log('Setting up form change listeners for field visibility');
      formGroup.valueChanges.pipe(
        debounceTime(300) // Debounce to prevent excessive validation calls
      ).subscribe((changes) => {
        console.log('Form value changed:', changes);
        if (this.isTestMode()) {
          this.dynamicFormService.evaluateValidationRules();
        }
        // Always evaluate workflow rules for field visibility
        this.evaluateWorkflowRulesForFieldVisibility();
      });
    }
  }

  private async loadWorkflowRules() {
    const rulesText = this.documentTypeForm.get('validationRules')?.value || '';
    console.log('Loading workflow rules from text:', rulesText);
    // Rules will be processed sequentially from first row as entered in validationRules field
    this.dynamicFormService.loadWorkflowRulesFromText(rulesText);
    console.log('Rules loaded into service:', this.dynamicFormService.workflowRules());
  }

  private evaluateWorkflowRulesForFieldVisibility() {
    const rules = this.dynamicFormService.workflowRules();
    const formGroup = this.dynamicFormService.dynamicFormGroup();
    const arrayData = this.dynamicFormService.arrayFieldData();
    
    if (!rules.length || !formGroup) {
      return;
    }

    console.log('Evaluating workflow rules for field visibility');
    
    for (const rule of rules) {
      try {
        // Check if this rule affects field visibility (has .hidden in action)
        if (rule.action.includes('.hidden')) {
          const conditionMet = this.evaluateSingleConditionForWorkflow(rule.validation, formGroup, arrayData);
          if (conditionMet) {
            this.executeFieldVisibilityAction(rule.action);
          }
        }
      } catch (error) {
        console.error('Error evaluating workflow rule:', rule, error);
      }
    }
  }

  private evaluateSingleConditionForWorkflow(condition: string, formGroup: any, arrayData: any): boolean {
    // Handle field.property conditions like "notrequired.value == false"
    const fieldPropertyMatch = condition.match(/(\w+)\.value\s*([=!<>]+)\s*(true|false|["']([^"']+)["']|\d+)/);
    if (fieldPropertyMatch) {
      const [, fieldName, operator, rawValue] = fieldPropertyMatch;
      let expectedValue = rawValue;
      
      // Remove quotes if present
      if ((expectedValue.startsWith('"') && expectedValue.endsWith('"')) ||
          (expectedValue.startsWith("'") && expectedValue.endsWith("'"))) {
        expectedValue = expectedValue.slice(1, -1);
      }
      
      const currentValue = formGroup?.get(fieldName)?.value;
      console.log(`Field property condition: ${fieldName}.value (${currentValue}) ${operator} ${expectedValue}`);
      
      // Handle boolean comparisons specially
      if (expectedValue === 'true' || expectedValue === 'false') {
        const currentBool = currentValue === true || currentValue === 'true';
        const expectedBool = expectedValue === 'true';
        
        switch (operator) {
          case '==': case '=': return currentBool === expectedBool;
          case '!=': return currentBool !== expectedBool;
          default: throw new Error(`Unsupported operator for boolean values: ${operator}`);
        }
      } else {
        // String comparison
        const currentStr = currentValue ? currentValue.toString() : '';
        
        switch (operator) {
          case '==': case '=': return currentStr === expectedValue;
          case '!=': return currentStr !== expectedValue;
          default: throw new Error(`Unsupported operator: ${operator}`);
        }
      }
    }
    
    // Fallback to regular condition evaluation
    return this.evaluateSingleCondition(condition, formGroup, arrayData);
  }

  private executeFieldVisibilityAction(action: string) {
    // Handle field.hidden assignment like "files.hidden = false"
    const hiddenMatch = action.match(/(\w+)\.hidden\s*=\s*(true|false)/);
    if (hiddenMatch) {
      const [, fieldKey, hiddenValue] = hiddenMatch;
      const shouldHide = hiddenValue === 'true';
      
      // Update the field's hidden property in dynamicFormFields
      const currentFields = this.dynamicFormService.dynamicFormFields();
      const updatedFields = currentFields.map(field => {
        if (field.key === fieldKey) {
          return { ...field, hidden: shouldHide };
        }
        return field;
      });
      
      this.dynamicFormService.dynamicFormFields.set(updatedFields);
      console.log(`✅ Set ${fieldKey}.hidden = ${shouldHide}`);
      return;
    }
    
    console.warn(`Unsupported field visibility action: ${action}`);
  }

  validateTestForm() {
    const formGroup = this.dynamicFormService.dynamicFormGroup();
    if (formGroup) {
      // Mark all fields as touched to show validation errors
      Object.keys(formGroup.controls).forEach(key => {
        formGroup.get(key)?.markAsTouched();
      });
      
      if (formGroup.valid) {
        this.formTestData.set('✅ Form is valid! All required fields are filled correctly.');
      } else {
        const errors = this.getFormValidationErrors(formGroup);
        this.formTestData.set(`❌ Form validation failed:\n${errors.join('\n')}`);
      }
    }
  }

  clearTestForm() {
    const formGroup = this.dynamicFormService.dynamicFormGroup();
    if (formGroup) {
      formGroup.reset();
      // Mark all fields as untouched to hide validation errors
      Object.keys(formGroup.controls).forEach(key => {
        formGroup.get(key)?.markAsUntouched();
      });
      this.formTestData.set(null);
      this.dynamicFormService.uploadedFiles.set({});
      this.dynamicFormService.arrayFieldData.set({});
    }
  }

  showFormData() {
    const formGroup = this.dynamicFormService.dynamicFormGroup();
    if (formGroup) {
      const formData = formGroup.value;
      const files = this.dynamicFormService.uploadedFiles();
      const arrays = this.dynamicFormService.arrayFieldData();
      
      // Combine form data with file information and array data
      const combinedData = {
        formData,
        uploadedFiles: files,
        arrayData: arrays
      };
      
      const formattedData = JSON.stringify(combinedData, null, 2);
      this.formTestData.set(formattedData);
    }
  }

  private getFormValidationErrors(formGroup: FormGroup): string[] {
    const errors: string[] = [];
    const fields = this.dynamicFormService.dynamicFormFields();
    
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      const field = fields.find(f => f.key === key);
      
      if (control && control.errors && control.touched) {
        const fieldLabel = field?.label || key;
        
        if (control.errors['required']) {
          errors.push(`• ${fieldLabel} is required`);
        }
        if (control.errors['email']) {
          errors.push(`• ${fieldLabel} must be a valid email address`);
        }
        if (control.errors['minlength']) {
          errors.push(`• ${fieldLabel} must be at least ${control.errors['minlength'].requiredLength} characters`);
        }
      }
    });
    
    return errors;
  }



  // AI Translation methods
  async translateToJson() {
    const freetext = this.definitionInWords();
    if (!freetext.trim()) return;

    this.isTranslating.set(true);
    try {
      // For now, create a basic JSON structure based on common patterns
      const jsonDefinition = this.generateBasicJsonFromText(freetext);
      this.documentTypeForm.patchValue({ definition: jsonDefinition });
      this.dynamicFormService.generateDynamicFormSchema(jsonDefinition);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      this.isTranslating.set(false);
    }
  }

  async translateToWords() {
    const jsonDefinition = this.documentTypeForm.get('definition')?.value;
    if (!jsonDefinition.trim()) return;

    this.isTranslating.set(true);
    try {
      // Parse JSON and convert to readable text
      const parsed = JSON.parse(jsonDefinition);
      if (parsed.fields && Array.isArray(parsed.fields)) {
        const words = parsed.fields.map((field: any) => {
          let description = `${field.label || field.key}`;
          if (field.type && field.type !== 'text') {
            description += ` (${field.type})`;
          }
          if (field.required) {
            description += ' - required';
          }
          if (field.description) {
            description += ` - ${field.description}`;
          }
          return description;
        }).join('\n');
        
        this.definitionInWords.set(words);
      }
    } catch (error) {
      console.error('Reverse translation error:', error);
      // Fallback: just remove JSON formatting
      const simplified = jsonDefinition
        .replace(/[{}"[\],]/g, '')
        .replace(/:/g, ' - ')
        .split('\n')
        .filter((line: string) => line.trim())
        .join('\n');
      this.definitionInWords.set(simplified);
    } finally {
      this.isTranslating.set(false);
    }
  }

  private generateBasicJsonFromText(text: string): string {
    const lines = text.split('\n').filter(line => line.trim());
    const fields: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Parse different formats
      let fieldName = '';
      let fieldType = 'text';
      let required = false;
      let description = '';

      // Look for type hints in parentheses
      const typeMatch = trimmed.match(/^([^(]+)\s*\(([^)]+)\)/);
      if (typeMatch) {
        fieldName = typeMatch[1].trim();
        const typeHint = typeMatch[2].toLowerCase();
        fieldType = this.inferFieldType(typeHint, fieldName);
      } else {
        // Simple field name, possibly with description after dash or colon
        const parts = trimmed.split(/\s*[-:]\s*/);
        fieldName = parts[0];
        if (parts[1]) {
          description = parts[1];
        }
        fieldType = this.inferFieldType(description, fieldName);
      }

      // Check for required indicators
      required = trimmed.toLowerCase().includes('required') || 
                trimmed.includes('*') || 
                fieldName.toLowerCase().includes('name') ||
                fieldName.toLowerCase().includes('email');

      if (fieldName) {
        fields.push({
          key: this.generateFieldKey(fieldName),
          type: fieldType,
          label: fieldName,
          required,
          placeholder: `Enter ${fieldName.toLowerCase()}`,
          ...(description && { description })
        });
      }
    }

    return JSON.stringify({ fields }, null, 2);
  }

}
