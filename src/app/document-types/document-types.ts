import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-document-types',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './document-types.html',
  styleUrl: './document-types.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentTypes implements OnInit, OnDestroy {
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  filteredDocumentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  docTypeSearchQuery = signal<string>('');
  showAllItems = signal<boolean>(false); // Default to show only active items
  loading = signal(true);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedDocumentType = signal<Schema['DocumentType']['type'] | null>(null);
  processing = signal(false);
  expandedDescriptions = signal<Set<string>>(new Set());
  
  // Dynamic form signals
  dynamicFormFields = signal<any[]>([]);
  dynamicFormGroup = signal<FormGroup | null>(null);
  definitionTimeout: any = null;
  
  // Workflow rule evaluation for dynamic field visibility
  workflowRules = signal<{validation: string, action: string}[]>([]);
  
  // Test mode signals
  isTestMode = signal<boolean>(false);
  formTestData = signal<string | null>(null);
  uploadedFiles = signal<{ [key: string]: string[] }>({});
  
  // AI Translation signals
  definitionInWords = signal<string>('');
  isTranslating = signal<boolean>(false);
  
  // Array field management
  arrayFieldData = signal<{ [fieldKey: string]: any[] }>({});
  
  // Validation rules
  validationResults = signal<{message: string, type: 'success' | 'warning' | 'error'}[]>([]);
  validationHasErrors = signal<boolean>(false);
  
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  
  private fb = inject(FormBuilder);
  private docTypeSearchTimeout: any = null;
  private validationTimeout: any = null;
  private identifierValidationTimeout: any = null;
  
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
      const client = generateClient<Schema>();
      const result = await client.models.DocumentType.list({
        filter: { identifier: { eq: value } }
      });
      
      // Check if identifier exists (excluding current document in edit mode)
      const existingDoc = result.data?.find(docType => 
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
    identifier: ['', [Validators.minLength(2), this.identifierValidator.bind(this)], [this.uniqueIdentifierValidator.bind(this)]],
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
    await this.loadDocumentTypes();
    
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
    this.documentTypeForm.get('validationRules')?.valueChanges.subscribe(() => {
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
      const client = generateClient<Schema>();
      const { data } = await client.models.DocumentType.list();
      this.documentTypes.set(data);
      this.applyDocTypeSearch(); // Initialize filtered document types
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
    
    // Clear any pending validation timeouts to prevent API calls during form initialization
    if (this.identifierValidationTimeout) {
      clearTimeout(this.identifierValidationTimeout);
    }
    
    // Generate identifier if it doesn't exist (for legacy records)
    const identifier = docType.identifier || this.generateIdentifier(docType.name || '');
    
    // Use setValue with emitEvent: false to prevent triggering validation during initialization
    this.documentTypeForm.patchValue({
      name: docType.name,
      identifier: identifier,
      definition: docType.definition,
      validationRules: (docType as any).validationRules || '',
      isActive: docType.isActive ?? true
    }, { emitEvent: false });
    
    // Re-enable events after a brief delay and generate dynamic form
    setTimeout(() => {
      this.documentTypeForm.get('identifier')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      
      // Manually trigger form generation for the definition since we used emitEvent: false
      const definition = this.documentTypeForm.get('definition')?.value;
      if (definition) {
        this.onDefinitionChange(definition);
      }
    }, 100);
    
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
      // Double-check uniqueness before creating
      const existingDocTypes = this.documentTypes();
      const isDuplicate = existingDocTypes.some(existing => 
        existing && existing.identifier === docType.identifier
      );
      
      if (isDuplicate) {
        throw new Error(`A document type with identifier "${docType.identifier}" already exists`);
      }

      const client = generateClient<Schema>();
      await client.models.DocumentType.create({
        ...docType,
        fields: [],
        usageCount: 0,
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
      // Double-check uniqueness before updating (if identifier is being changed)
      if (updates.identifier) {
        const existingDocTypes = this.documentTypes();
        const isDuplicate = existingDocTypes.some(existing => 
          existing && existing.identifier === updates.identifier && existing.id !== id
        );
        
        if (isDuplicate) {
          throw new Error(`A document type with identifier "${updates.identifier}" already exists`);
        }
      }

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

  async archiveDocumentType(docType: Schema['DocumentType']['type']) {
    if (!confirm(`Are you sure you want to archive "${docType.name}"?`)) return;

    this.processing.set(true);
    
    try {
      const client = generateClient<Schema>();
      await client.models.DocumentType.update({ 
        id: docType.id,
        isActive: false // Set to inactive when archived
      });
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
      const client = generateClient<Schema>();
      await client.models.DocumentType.update({ 
        id: docType.id,
        isActive: true // Set to active when restored
      });
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
      this.onDefinitionChange(docType.definition);
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
      this.arrayFieldData.set({});
      this.generateDynamicFormSchema(definition);
    }, 500); // 500ms delay to avoid excessive updates while typing
  }

  // Generate dynamic form from definition text
  generateDynamicFormSchema(definition: string) {
    if (!definition || definition.trim().length < 10) {
      this.dynamicFormFields.set([]);
      this.dynamicFormGroup.set(null);
      return;
    }

    try {
      // Try to parse as JSON first
      const parsedJson = JSON.parse(definition);
      if (this.isValidFormSchema(parsedJson)) {
        this.createFormFromSchema(parsedJson);
        return;
      }
    } catch (e) {
      // Not JSON, continue with text analysis
    }

    // Analyze text to generate form schema
    const schema = this.analyzeTextToFormSchema(definition);
    if (schema) {
      this.createFormFromSchema(schema);
    }
  }

  // Create Angular reactive form from schema
  private createFormFromSchema(schema: any) {
    if (!schema?.fields || !Array.isArray(schema.fields)) return;

    const formControls: { [key: string]: FormControl } = {};
    const fieldMetadata: any[] = [];

    schema.fields.forEach((field: any) => {
      // Skip array fields - they're managed separately
      if (field.type === 'array') {
        fieldMetadata.push(field);
        return;
      }

      const validators = [];
      if (field.required) {
        validators.push(Validators.required);
      }
      if (field.minLength) {
        validators.push(Validators.minLength(field.minLength));
      }
      if (field.type === 'email') {
        validators.push(Validators.email);
      }

      const controlConfig = field.disabled 
        ? { value: field.defaultValue || '', disabled: true }
        : field.defaultValue || '';
      
      formControls[field.key] = new FormControl(controlConfig, validators);
      fieldMetadata.push(field);
    });

    const formGroup = this.fb.group(formControls);
    this.dynamicFormGroup.set(formGroup);
    this.dynamicFormFields.set(fieldMetadata);
    
    // Setup form change subscription for validation rules (will be activated in test mode)
    this.setupFormChangeListeners();
    
    // Load workflow rules for this document type
    this.loadWorkflowRules();
  }

  // Check if parsed JSON is a valid form schema
  private isValidFormSchema(obj: any): boolean {
    return obj && (
      (obj.fields && Array.isArray(obj.fields)) ||
      (obj.properties && typeof obj.properties === 'object') ||
      (obj.type && obj.properties)
    );
  }

  // Analyze text content to generate form schema
  private analyzeTextToFormSchema(definition: string): any {
    const fields: any[] = [];
    const lines = definition.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (const line of lines) {
      // Look for common field patterns
      const fieldPatterns = [
        // "Field Name: description" or "Field Name - description"
        /^([^:_-]+)[\s]*[:\-_][\s]*(.+)$/,
        // "Field Name (type)" or "Field Name [type]"
        /^([^(\[]+)[\s]*[\(\[]([^\)\]]+)[\)\]][\s]*(.*)$/,
        // Simple field names
        /^([A-Za-z][A-Za-z0-9\s]+)$/
      ];

      for (const pattern of fieldPatterns) {
        const match = line.match(pattern);
        if (match) {
          const fieldName = match[1].trim();
          const fieldType = this.inferFieldType(match[2] || match[3] || '', fieldName);
          const description = match[3] || match[2] || '';

          if (fieldName && fieldName.length > 1) {
            fields.push({
              key: this.generateFieldKey(fieldName),
              type: fieldType,
              label: fieldName,
              placeholder: `Enter ${fieldName.toLowerCase()}`,
              description: description.trim() || undefined,
              required: this.isFieldRequired(line, fieldName)
            });
          }
          break;
        }
      }
    }

    if (fields.length === 0) {
      // If no specific fields found, create some basic fields based on content
      const words = definition.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      const commonFields = ['name', 'description', 'email', 'address', 'phone', 'date', 'amount', 'notes'];
      
      for (const commonField of commonFields) {
        if (words.some(word => word.includes(commonField) || commonField.includes(word))) {
          fields.push({
            key: commonField,
            type: this.inferFieldType('', commonField),
            label: commonField.charAt(0).toUpperCase() + commonField.slice(1),
            placeholder: `Enter ${commonField}`,
            required: commonField === 'name'
          });
        }
      }
    }

    return fields.length > 0 ? { fields } : null;
  }

  // Infer field type from description or field name
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

  // Check if field is required based on context
  private isFieldRequired(line: string, fieldName: string): boolean {
    const text = line.toLowerCase();
    return text.includes('required') || 
           text.includes('mandatory') || 
           text.includes('*') ||
           fieldName.toLowerCase().includes('name') ||
           fieldName.toLowerCase().includes('email');
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
    this.onDefinitionChange(definition);
  }

  // Test mode functionality
  toggleFormTestMode() {
    this.isTestMode.set(!this.isTestMode());
    this.formTestData.set(null);
    
    if (!this.isTestMode()) {
      // Clear form when exiting test mode
      this.clearTestForm();
      this.uploadedFiles.set({});
      this.arrayFieldData.set({});
      this.validationResults.set([]);
      this.validationHasErrors.set(false);
    } else {
      // Run initial validation when entering test mode
      setTimeout(() => this.evaluateValidationRules(), 100);
    }
  }

  private setupFormChangeListeners() {
    // This will be called whenever the form is recreated
    const formGroup = this.dynamicFormGroup();
    if (formGroup) {
      console.log('Setting up form change listeners for field visibility');
      formGroup.valueChanges.pipe(
        debounceTime(300) // Debounce to prevent excessive validation calls
      ).subscribe((changes) => {
        console.log('Form value changed:', changes);
        if (this.isTestMode()) {
          this.evaluateValidationRules();
        }
        // Always evaluate workflow rules for field visibility
        this.evaluateWorkflowRulesForFieldVisibility();
      });
    }
  }

  private async loadWorkflowRules() {
    // Load workflow rules from the validation rules field
    const rulesText = this.documentTypeForm.get('validationRules')?.value || '';
    if (!rulesText.trim()) {
      this.workflowRules.set([]);
      return;
    }

    const rules: {validation: string, action: string}[] = [];
    const lines = rulesText.split('\n').filter((line: string) => line.trim());
    
    for (const line of lines) {
      const parts = line.split('action:').map((p: string) => p.trim());
      if (parts.length === 2) {
        const validation = parts[0].replace('validation:', '').trim();
        const action = parts[1].trim();
        rules.push({ validation, action });
      }
    }
    
    this.workflowRules.set(rules);
    console.log('Loaded workflow rules:', rules);
  }

  private evaluateWorkflowRulesForFieldVisibility() {
    const rules = this.workflowRules();
    const formGroup = this.dynamicFormGroup();
    const arrayData = this.arrayFieldData();
    
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
      const currentFields = this.dynamicFormFields();
      const updatedFields = currentFields.map(field => {
        if (field.key === fieldKey) {
          return { ...field, hidden: shouldHide };
        }
        return field;
      });
      
      this.dynamicFormFields.set(updatedFields);
      console.log(`✅ Set ${fieldKey}.hidden = ${shouldHide}`);
      return;
    }
    
    console.warn(`Unsupported field visibility action: ${action}`);
  }

  validateTestForm() {
    const formGroup = this.dynamicFormGroup();
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
    const formGroup = this.dynamicFormGroup();
    if (formGroup) {
      formGroup.reset();
      // Mark all fields as untouched to hide validation errors
      Object.keys(formGroup.controls).forEach(key => {
        formGroup.get(key)?.markAsUntouched();
      });
      this.formTestData.set(null);
      this.uploadedFiles.set({});
      this.arrayFieldData.set({});
    }
  }

  showFormData() {
    const formGroup = this.dynamicFormGroup();
    if (formGroup) {
      const formData = formGroup.value;
      const files = this.uploadedFiles();
      const arrays = this.arrayFieldData();
      
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
    const fields = this.dynamicFormFields();
    
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

  // File upload handling
  onFileChange(fieldKey: string, event: any) {
    const fileList = event.target.files;
    if (fileList && fileList.length > 0) {
      const files = this.uploadedFiles();
      const fileNames: string[] = [];
      
      // Convert FileList to array of file names
      for (let i = 0; i < fileList.length; i++) {
        fileNames.push(fileList[i].name);
      }
      
      files[fieldKey] = fileNames;
      this.uploadedFiles.set({ ...files });
      
      // Update form control value for validation
      const formGroup = this.dynamicFormGroup();
      if (formGroup) {
        const value = fileNames.length === 1 ? fileNames[0] : fileNames.join(', ');
        formGroup.get(fieldKey)?.setValue(value);
        formGroup.get(fieldKey)?.markAsTouched();
      }
      
      // Trigger validation rules evaluation since file changes don't trigger form valueChanges
      if (this.isTestMode()) {
        setTimeout(() => this.evaluateValidationRules(), 300);
      }
    }
  }

  removeFile(fieldKey: string) {
    const files = this.uploadedFiles();
    delete files[fieldKey];
    this.uploadedFiles.set({ ...files });
    
    // Clear form control value
    const formGroup = this.dynamicFormGroup();
    if (formGroup) {
      formGroup.get(fieldKey)?.setValue(null);
    }
    
    // Trigger validation rules evaluation since file changes don't trigger form valueChanges
    if (this.isTestMode()) {
      setTimeout(() => this.evaluateValidationRules(), 300);
    }
  }

  removeSingleFile(fieldKey: string, fileName: string) {
    const files = this.uploadedFiles();
    if (files[fieldKey]) {
      files[fieldKey] = files[fieldKey].filter(name => name !== fileName);
      if (files[fieldKey].length === 0) {
        delete files[fieldKey];
      }
      this.uploadedFiles.set({ ...files });
      
      // Update form control value
      const formGroup = this.dynamicFormGroup();
      if (formGroup) {
        const remainingFiles = files[fieldKey] || [];
        const value = remainingFiles.length === 0 ? null : 
                     remainingFiles.length === 1 ? remainingFiles[0] : 
                     remainingFiles.join(', ');
        formGroup.get(fieldKey)?.setValue(value);
      }
    }
    
    // Trigger validation rules evaluation since file changes don't trigger form valueChanges
    if (this.isTestMode()) {
      setTimeout(() => this.evaluateValidationRules(), 300);
    }
  }

  getFileName(fieldKey: string): string | null {
    const files = this.uploadedFiles()[fieldKey];
    return files && files.length > 0 ? files[0] : null;
  }

  getFileNames(fieldKey: string): string[] {
    return this.uploadedFiles()[fieldKey] || [];
  }

  getArraySubFields(field: any): any[] {
    // Handle multiple schema naming conventions
    let itemSchema = field.itemSchema || field.schema;
    
    // Try dynamic schema name like clientsSchema, usersSchema, etc.
    if (!itemSchema) {
      const schemaKey = `${field.key}Schema`;
      itemSchema = field[schemaKey];
    }
    
    // Also try common variations
    if (!itemSchema) {
      const variations = [
        `${field.key}Schema`,
        `${field.key}ItemSchema`,
        `item_schema`,
        `items_schema`
      ];
      
      for (const variation of variations) {
        if (field[variation]) {
          itemSchema = field[variation];
          break;
        }
      }
    }
    
    console.log('Looking for schema in field:', field.key);
    console.log('Available keys in field:', Object.keys(field));
    console.log('Found itemSchema:', itemSchema);
    
    if (!itemSchema || typeof itemSchema !== 'object') {
      console.log('Invalid itemSchema for field:', field.key, itemSchema);
      return [];
    }
    
    const subFields = Object.keys(itemSchema).map(key => ({
      key,
      label: itemSchema[key]?.label || key,
      type: itemSchema[key]?.type || 'text',
      placeholder: itemSchema[key]?.placeholder || '',
      required: itemSchema[key]?.required || false,
      readonly: itemSchema[key]?.readonly || false
    }));
    
    console.log('Array sub-fields for', field.key, ':', subFields);
    return subFields;
  }

  // Array field management methods
  getArrayItems(fieldKey: string): any[] {
    const items = this.arrayFieldData()[fieldKey] || [];
    console.log(`Getting array items for ${fieldKey}:`, items);
    return items;
  }

  addArrayItem(fieldKey: string, field: any) {
    console.log('Adding array item for field:', fieldKey, field);
    console.log('Field keys available:', Object.keys(field));
    
    // Use the same schema detection logic as getArraySubFields
    let itemSchema = field.itemSchema || field.schema;
    
    if (!itemSchema) {
      const schemaKey = `${field.key}Schema`;
      itemSchema = field[schemaKey];
      console.log(`Trying schema key: ${schemaKey}`, itemSchema);
    }
    
    if (!itemSchema) {
      const variations = [
        `${field.key}Schema`,
        `${field.key}ItemSchema`,
        `item_schema`,
        `items_schema`
      ];
      
      for (const variation of variations) {
        if (field[variation]) {
          itemSchema = field[variation];
          console.log(`Found schema with variation: ${variation}`, itemSchema);
          break;
        }
      }
    }
    
    console.log('Using itemSchema:', itemSchema);
    
    const currentData = this.arrayFieldData();
    const currentItems = currentData[fieldKey] || [];
    
    // Create new empty item based on schema - ensure each item is a unique object
    const newItem: any = {};
    
    if (itemSchema && typeof itemSchema === 'object') {
      Object.keys(itemSchema).forEach(key => {
        const fieldDef = itemSchema[key];
        // Create a new value for each item (avoid object references)
        const defaultValue = fieldDef?.defaultValue;
        newItem[key] = defaultValue ? JSON.parse(JSON.stringify(defaultValue)) : '';
      });
    }
    
    console.log('New item created:', newItem);
    
    const updatedItems = [...currentItems, newItem];
    this.arrayFieldData.set({
      ...currentData,
      [fieldKey]: updatedItems
    });
    
    console.log('Updated array data:', this.arrayFieldData());
    
    // Trigger validation for array changes (not connected to form valueChanges)
    if (this.isTestMode()) {
      setTimeout(() => this.evaluateValidationRules(), 300);
    }
  }

  removeArrayItem(fieldKey: string, index: number) {
    const currentData = this.arrayFieldData();
    const currentItems = currentData[fieldKey] || [];
    
    const updatedItems = currentItems.filter((_, i) => i !== index);
    this.arrayFieldData.set({
      ...currentData,
      [fieldKey]: updatedItems
    });
    
    // Trigger validation for array changes (not connected to form valueChanges)
    if (this.isTestMode()) {
      setTimeout(() => this.evaluateValidationRules(), 300);
    }
  }

  updateArrayItem(fieldKey: string, itemIndex: number, subFieldKey: string, value: any) {
    console.log(`Updating array item: field=${fieldKey}, index=${itemIndex}, subField=${subFieldKey}, value=${value}`);
    
    const currentData = this.arrayFieldData();
    const currentItems = currentData[fieldKey] || [];
    console.log(`Current items count: ${currentItems.length}, updating index: ${itemIndex}`);
    console.log('Current items before update:', currentItems);
    
    if (itemIndex >= currentItems.length) {
      console.error(`Index ${itemIndex} is out of bounds for array of length ${currentItems.length}`);
      return;
    }
    
    // Create a deep copy to avoid reference issues
    const updatedItems = currentItems.map((item, index) => {
      if (index === itemIndex) {
        // Create a new object for this specific item
        const updatedItem = {
          ...JSON.parse(JSON.stringify(item)), // Deep clone to avoid references
          [subFieldKey]: value
        };
        console.log(`Updated item at index ${index}:`, updatedItem);
        return updatedItem;
      }
      return JSON.parse(JSON.stringify(item)); // Deep clone other items too
    });
    
    console.log('All updated items:', updatedItems);
    
    this.arrayFieldData.set({
      ...currentData,
      [fieldKey]: updatedItems
    });
    
    // Trigger validation for array changes (not connected to form valueChanges)
    if (this.isTestMode()) {
      setTimeout(() => this.evaluateValidationRules(), 300);
    }
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
      this.onDefinitionChange(jsonDefinition);
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

  // Validation Rules Engine
  evaluateValidationRules() {
    console.log('=== EVALUATING VALIDATION RULES ===');
    const rulesText = this.documentTypeForm.get('validationRules')?.value || '';
    console.log('Rules text:', rulesText);
    
    if (!rulesText.trim()) {
      console.log('No validation rules defined');
      this.validationResults.set([]);
      this.validationHasErrors.set(false);
      return;
    }

    const formGroup = this.dynamicFormGroup();
    const arrayData = this.arrayFieldData();
    console.log('Form group:', formGroup);
    console.log('Array data:', arrayData);
    
    const results: {message: string, type: 'success' | 'warning' | 'error'}[] = [];
    let hasErrors = false;

    // Parse rules line by line
    const rules = rulesText.split('\n').filter((line: string) => line.trim());
    console.log('Parsed rules:', rules);
    
    for (const rule of rules) {
      console.log(`Processing rule: "${rule}"`);
      try {
        const result = this.parseAndExecuteRule(rule, formGroup, arrayData);
        console.log('Rule result:', result);
        
        if (result) {
          if (result.startsWith('✅')) {
            results.push({ message: result, type: 'success' });
          } else if (result.startsWith('⚠️')) {
            results.push({ message: result, type: 'warning' });
          } else {
            results.push({ message: result, type: 'success' });
          }
        } else {
          results.push({ message: `ℹ️ Rule "${rule}" condition not met`, type: 'warning' });
        }
      } catch (error) {
        console.error('Rule error:', error);
        hasErrors = true;
        results.push({ 
          message: `❌ Error in rule "${rule}": ${error}`, 
          type: 'error' 
        });
      }
    }

    console.log('Final validation results:', results);
    this.validationResults.set(results);
    this.validationHasErrors.set(hasErrors);
  }

  private parseAndExecuteRule(rule: string, formGroup: any, arrayData: any): string | null {
    // Parse rule format: "validation : condition action : field = value"
    const parts = rule.split('action:').map(p => p.trim());
    if (parts.length !== 2) {
      throw new Error('Rule must contain "action:" separator');
    }

    const condition = parts[0].replace('validation:', '').trim();
    const actionsPart = parts[1].trim();

    // Evaluate condition
    const conditionResult = this.evaluateCondition(condition, formGroup, arrayData);
    
    if (conditionResult) {
      // Split actions by commas and execute each one
      const actions = actionsPart.split(',').map(a => a.trim()).filter(a => a.length > 0);
      const results: string[] = [];
      
      for (const action of actions) {
        const result = this.executeAction(action, formGroup, arrayData);
        if (result) {
          results.push(result);
        }
      }
      
      return results.length > 0 ? results.join(', ') : null;
    }

    return null;
  }

  private evaluateCondition(condition: string, formGroup: any, arrayData: any): boolean {
    // Handle AND/OR operators by splitting the condition
    if (condition.includes(' & ') || condition.includes(' | ') || condition.includes(' and ') || condition.includes(' or ')) {
      return this.evaluateComplexCondition(condition, formGroup, arrayData);
    }
    
    // Handle single conditions
    return this.evaluateSingleCondition(condition, formGroup, arrayData);
  }

  private evaluateComplexCondition(condition: string, formGroup: any, arrayData: any): boolean {
    // Handle AND operator (& or 'and')
    if (condition.includes(' & ') || condition.includes(' and ')) {
      const andParts = condition.includes(' & ') 
        ? condition.split(' & ').map(part => part.trim())
        : condition.split(' and ').map(part => part.trim());
      console.log(`Evaluating AND condition: ${andParts.join(' AND ')}`);
      
      // All parts must be true for AND
      for (const part of andParts) {
        const result = this.evaluateSingleCondition(part, formGroup, arrayData);
        console.log(`  AND part "${part}": ${result}`);
        if (!result) return false;
      }
      return true;
    }
    
    // Handle OR operator (| or 'or')
    if (condition.includes(' | ') || condition.includes(' or ')) {
      const orParts = condition.includes(' | ')
        ? condition.split(' | ').map(part => part.trim())
        : condition.split(' or ').map(part => part.trim());
      console.log(`Evaluating OR condition: ${orParts.join(' OR ')}`);
      
      // Any part can be true for OR
      for (const part of orParts) {
        const result = this.evaluateSingleCondition(part, formGroup, arrayData);
        console.log(`  OR part "${part}": ${result}`);
        if (result) return true;
      }
      return false;
    }
    
    // Fallback to single condition
    return this.evaluateSingleCondition(condition, formGroup, arrayData);
  }

  private evaluateSingleCondition(condition: string, formGroup: any, arrayData: any): boolean {
    // Handle allRequired() condition
    const allRequiredMatch = condition.match(/allRequired\(\)\s*([><=!]+)\s*(true|false)/);
    if (allRequiredMatch) {
      const [, operator, expectedStr] = allRequiredMatch;
      const expected = expectedStr === 'true';
      const allFieldsFilled = this.checkAllRequiredFields(formGroup, arrayData);
      
      switch (operator) {
        case '==': case '=': return allFieldsFilled === expected;
        case '!=': return allFieldsFilled !== expected;
        default: throw new Error(`Unsupported operator for allRequired(): ${operator}`);
      }
    }

    // Handle array count conditions like "clients.count() > 1" or file count like "files.count() > 0"
    const arrayCountMatch = condition.match(/(\w+)\.count\(\)\s*([><=!]+)\s*(\d+)/);
    if (arrayCountMatch) {
      const [, fieldKey, operator, valueStr] = arrayCountMatch;
      const expectedCount = parseInt(valueStr);
      let actualCount = 0;
      
      // Check if this is a file field by looking at the form fields
      const fields = this.dynamicFormFields();
      const field = fields.find(f => f.key === fieldKey);
      
      if (field && field.type === 'file') {
        // For file fields, check uploadedFiles signal
        const uploadedFiles = this.uploadedFiles();
        const fileList = uploadedFiles[fieldKey] || [];
        actualCount = fileList.length;
        console.log(`File count check: ${fieldKey} has ${actualCount} files`);
      } else {
        // For array fields, check arrayData
        actualCount = (arrayData[fieldKey] || []).length;
        console.log(`Array count check: ${fieldKey} has ${actualCount} items`);
      }
      
      switch (operator) {
        case '>': return actualCount > expectedCount;
        case '<': return actualCount < expectedCount;
        case '>=': return actualCount >= expectedCount;
        case '<=': return actualCount <= expectedCount;
        case '==': case '=': return actualCount === expectedCount;
        case '!=': return actualCount !== expectedCount;
        default: throw new Error(`Unknown operator: ${operator}`);
      }
    }

    // Handle file field conditions like "file != null"
    const fileFieldMatch = condition.match(/(\w+)\s*([><=!]+)\s*null/);
    if (fileFieldMatch) {
      const [, fieldKey, operator] = fileFieldMatch;
      const fileValue = formGroup?.get(fieldKey)?.value;
      const hasFile = fileValue && fileValue.trim().length > 0;
      
      console.log(`File condition check: ${fieldKey} (${fileValue}) ${operator} null = ${hasFile}`);
      
      switch (operator) {
        case '!=': case '<>': return hasFile;
        case '==': case '=': return !hasFile;
        default: throw new Error(`Unsupported operator for file conditions: ${operator}`);
      }
    }

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
      
      console.log(`Condition check: ${fieldKey} (${actualValue}) ${operator} ${expectedValue}`);
      
      switch (operator) {
        case '==': case '=': return actualValue === expectedValue;
        case '!=': return actualValue !== expectedValue;
        default: throw new Error(`Unsupported operator for field values: ${operator}`);
      }
    }

    throw new Error(`Unsupported condition format: ${condition}`);
  }

  private executeAction(action: string, formGroup: any, arrayData: any): string {
    // Handle field.disabled assignment like "file.disabled = true"
    const disabledMatch = action.match(/(\w+)\.disabled\s*=\s*(true|false)/);
    if (disabledMatch) {
      const [, fieldKey, disabledValue] = disabledMatch;
      const shouldDisable = disabledValue === 'true';
      
      const control = formGroup?.get(fieldKey);
      if (control) {
        if (shouldDisable && !control.disabled) {
          control.disable();
          return `✅ Disabled ${fieldKey}`;
        } else if (!shouldDisable && control.disabled) {
          control.enable();
          return `✅ Enabled ${fieldKey}`;
        } else {
          return `✅ ${fieldKey} already ${shouldDisable ? 'disabled' : 'enabled'}`;
        }
      } else {
        return `⚠️ Field "${fieldKey}" not found`;
      }
    }
    
    // Handle field.hidden assignment like "files.hidden = true"
    const hiddenMatch = action.match(/(\w+)\.hidden\s*=\s*(true|false)/);
    if (hiddenMatch) {
      const [, fieldKey, hiddenValue] = hiddenMatch;
      const shouldHide = hiddenValue === 'true';
      
      // Find the field definition to update its hidden property
      const fields = this.dynamicFormFields();
      const fieldIndex = fields.findIndex(f => f.key === fieldKey);
      
      if (fieldIndex !== -1) {
        const field = fields[fieldIndex];
        if (shouldHide && !field.hidden) {
          field.hidden = true;
          this.dynamicFormFields.set([...fields]); // Trigger signal update
          return `✅ Hidden ${fieldKey}`;
        } else if (!shouldHide && field.hidden) {
          field.hidden = false;
          this.dynamicFormFields.set([...fields]); // Trigger signal update
          return `✅ Shown ${fieldKey}`;
        } else {
          return `✅ ${fieldKey} already ${shouldHide ? 'hidden' : 'shown'}`;
        }
      } else {
        return `⚠️ Field "${fieldKey}" not found`;
      }
    }
    
    // Handle field assignment like "status = filled"
    const assignmentMatch = action.match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
    if (assignmentMatch) {
      const [, fieldKey, value] = assignmentMatch;
      
      const control = formGroup?.get(fieldKey);
      if (control) {
        // Only update if the value actually changed
        if (control.value !== value) {
          // Temporarily enable the field if it's disabled to allow updates
          const wasDisabled = control.disabled;
          if (wasDisabled) {
            control.enable();
          }
          
          control.setValue(value, { emitEvent: false }); // Prevent triggering change events
          
          // Re-disable if it was originally disabled
          if (wasDisabled) {
            control.disable();
          }
          
          return `✅ Set ${fieldKey} = ${value}`;
        } else {
          return `✅ ${fieldKey} already set to ${value}`;
        }
      } else {
        return `⚠️ Field "${fieldKey}" not found`;
      }
    }

    throw new Error(`Unsupported action format: ${action}`);
  }

  private checkAllRequiredFields(formGroup: any, arrayData: any): boolean {
    const fields = this.dynamicFormFields();
    console.log('Checking required fields. Total fields:', fields.length);
    
    for (const field of fields) {
      console.log(`Checking field: ${field.key}, required: ${field.required}, type: ${field.type}`);
      
      if (field.required) {
        if (field.type === 'array') {
          // For array fields, check if they have at least one item
          const items = arrayData[field.key] || [];
          console.log(`Array field ${field.key} has ${items.length} items`);
          
          if (items.length === 0) {
            console.log(`Array field ${field.key} is empty - failing validation`);
            return false;
          }
          
          // Check if all required sub-fields in each array item are filled
          const itemSchema = field.itemSchema || field[`${field.key}Schema`] || field.schema;
          if (itemSchema) {
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              console.log(`Checking array item ${i}:`, item);
              
              for (const [subKey, subField] of Object.entries(itemSchema as any)) {
                const fieldDef = subField as any;
                if (fieldDef?.required) {
                  const subValue = item[subKey];
                  console.log(`  Sub-field ${subKey}: required=${fieldDef.required}, value="${subValue}"`);
                  
                  if (!subValue || subValue.toString().trim() === '') {
                    console.log(`  Sub-field ${subKey} is empty - failing validation`);
                    return false;
                  }
                }
              }
            }
          }
        } else {
          // For regular fields, check if they have a value
          const value = formGroup?.get(field.key)?.value;
          console.log(`Regular field ${field.key}: value="${value}"`);
          
          if (!value || value.toString().trim() === '') {
            console.log(`Regular field ${field.key} is empty - failing validation`);
            return false;
          }
        }
      }
    }
    
    console.log('All required fields are filled - validation passed');
    return true;
  }

}
