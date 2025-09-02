import { Component, OnInit, OnDestroy, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';

interface WorkflowRule {
  id: string;
  validation: string;
  action: string;
}

@Component({
  selector: 'app-workflows',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './workflows.html',
  styleUrl: './workflows.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Workflows implements OnInit, OnDestroy {
  workflows = signal<Array<Schema['Workflow']['type']>>([]);
  filteredWorkflows = signal<Array<Schema['Workflow']['type']>>([]);
  workflowSearchQuery = signal<string>('');
  loading = signal(true);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedWorkflow = signal<Schema['Workflow']['type'] | null>(null);
  processing = signal(false);
  
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  projects = signal<Array<Schema['Project']['type']>>([]);
  showDocumentTypeSidebar = signal(false);
  documentTypeSearchQuery = signal<string>('');
  filteredDocumentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  currentRuleIndex = signal<number>(-1);
  currentFieldType = signal<'validation' | 'action'>('validation');
  
  showLeftSidebar = signal(false);
  selectedDocumentTypeForPreview = signal<Schema['DocumentType']['type'] | null>(null);
  parsedFormFields = signal<any[]>([]);
  
  flowchartNodes = signal<any[]>([]);
  flowchartConnections = signal<any[]>([]);
  flowchartViewBox = signal<string>('0 0 600 400');
  zoomLevel = signal<number>(1);
  panX = signal<number>(0);
  panY = signal<number>(0);
  highlightedRuleIndex = signal<number | null>(null);
  invalidDocumentTypes = signal<Set<string>>(new Set());
  
  // Permissions matrix
  permissionsMatrix = signal<{ [docTypeId: string]: { [actorName: string]: 'X' | 'R' | 'W' } }>({});
  actors = signal<string[]>(['project owner', 'project admin', 'builder', 'soil tester', 'draftperson']);
  newActorName = signal<string>('');
  
  private fb = inject(FormBuilder);
  private searchTimeout: any = null;
  
  workflowForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    isActive: [true, [Validators.required]],
    rules: this.fb.array([])
  });

  get rulesFormArray(): FormArray {
    return this.workflowForm.get('rules') as FormArray;
  }

  async ngOnInit() {
    await Promise.all([
      this.loadWorkflows(),
      this.loadDocumentTypes(),
      this.loadProjects()
    ]);
    this.addRule(); // Start with one empty rule
    
    // Subscribe to form changes to regenerate flowchart
    this.workflowForm.get('rules')?.valueChanges.subscribe(() => {
      setTimeout(() => {
        this.generateFlowchart();
        this.initializePermissionsMatrix();
      }, 100);
    });
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  async loadWorkflows() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Workflow.list();
      this.workflows.set(data);
      this.applyWorkflowSearch();
    } catch (error) {
      console.error('Error loading workflows:', error);
      this.workflows.set([]);
      this.filteredWorkflows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  openCreateForm() {
    this.currentMode.set('create');
    this.selectedWorkflow.set(null);
    this.workflowForm.reset();
    this.workflowForm.patchValue({ isActive: true });
    this.clearRules();
    this.addRule();
    // Reset to default actors for new workflow
    this.actors.set(['project owner', 'project admin', 'builder', 'soil tester', 'draftperson']);
    this.showForm.set(true);
  }

  openEditForm(workflow: Schema['Workflow']['type']) {
    this.currentMode.set('edit');
    this.selectedWorkflow.set(workflow);
    
    this.workflowForm.patchValue({
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive ?? true
    });
    
    this.clearRules();
    const rules = workflow.rules || [];
    if (rules.length === 0) {
      this.addRule();
    } else {
      rules.forEach((ruleString: any) => {
        try {
          const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
          this.addRule(rule.validation || '', rule.action || '');
        } catch (error) {
          console.error('Error parsing rule for edit:', ruleString, error);
          this.addRule('', '');
        }
      });
    }
    
    // Load actors from workflow
    if (workflow.actors && workflow.actors.length > 0) {
      this.actors.set([...workflow.actors.filter((actor: string | null) => actor !== null)]);
    } else {
      // Reset to default actors if none saved
      this.actors.set(['project owner', 'project admin', 'builder', 'soil tester', 'draftperson']);
    }
    
    this.showForm.set(true);
  }

  openViewMode(workflow: Schema['Workflow']['type']) {
    this.currentMode.set('view');
    this.selectedWorkflow.set(workflow);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.currentMode.set('create');
    this.selectedWorkflow.set(null);
    this.workflowForm.reset();
    this.workflowForm.patchValue({ isActive: true });
    this.clearRules();
    this.addRule();
    // Reset to default actors
    this.actors.set(['project owner', 'project admin', 'builder', 'soil tester', 'draftperson']);
  }

  addRule(validation: string = '', action: string = '') {
    const ruleGroup = this.fb.group({
      validation: [validation, [Validators.required, Validators.minLength(3)]],
      action: [action, [Validators.required, Validators.minLength(3)]],
      _id: [Date.now() + Math.random()] // Unique identifier for tracking
    });
    
    this.rulesFormArray.push(ruleGroup);
    
    // Regenerate flowchart and permissions matrix after adding rule
    setTimeout(() => {
      this.generateFlowchart();
      this.initializePermissionsMatrix();
    }, 0);
  }

  removeRule(index: number) {
    if (this.rulesFormArray.length > 1) {
      this.rulesFormArray.removeAt(index);
      // Regenerate flowchart and permissions matrix after removing rule
      setTimeout(() => {
        this.generateFlowchart();
        this.initializePermissionsMatrix();
      }, 0);
    }
  }

  cloneRule(index: number) {
    console.log(`=== CLONE RULE DEBUG ===`);
    console.log(`Requested clone index: ${index}`);
    console.log(`Current rulesFormArray length: ${this.rulesFormArray.length}`);
    console.log(`All current rule values:`, this.rulesFormArray.controls.map((rule, i) => ({
      index: i,
      validation: rule.get('validation')?.value,
      action: rule.get('action')?.value
    })));
    
    if (index < 0 || index >= this.rulesFormArray.length) {
      console.error(`Invalid rule index: ${index}, array length: ${this.rulesFormArray.length}`);
      return;
    }
    
    const ruleToClone = this.rulesFormArray.at(index);
    if (!ruleToClone) {
      console.error(`No rule found at index: ${index}`);
      return;
    }
    
    const validation = ruleToClone.get('validation')?.value || '';
    const action = ruleToClone.get('action')?.value || '';
    
    console.log(`Cloning rule at index ${index}:`, { validation, action });
    
    // Create exact copy without "(Copy)" suffix for cleaner workflow rules
    const newRuleGroup = this.fb.group({
      validation: [validation, [Validators.required, Validators.minLength(3)]],
      action: [action, [Validators.required, Validators.minLength(3)]],
      _id: [Date.now() + Math.random()] // Unique identifier for tracking
    });
    
    // Insert the cloned rule right after the original
    this.rulesFormArray.insert(index + 1, newRuleGroup);
    
    console.log(`Rule cloned successfully. New array length: ${this.rulesFormArray.length}`);
    console.log(`New rule values after clone:`, this.rulesFormArray.controls.map((rule, i) => ({
      index: i,
      validation: rule.get('validation')?.value,
      action: rule.get('action')?.value
    })));
    
    // Regenerate flowchart after cloning rule
    setTimeout(() => this.generateFlowchart(), 0);
    
    // Scroll to and highlight the cloned rule
    setTimeout(() => {
      this.highlightAndScrollToRule(index + 1);
    }, 100);
  }

  clearRules() {
    while (this.rulesFormArray.length !== 0) {
      this.rulesFormArray.removeAt(0);
    }
  }


  async onSubmitForm() {
    console.log('Form submission started', {
      valid: this.workflowForm.valid,
      mode: this.currentMode(),
      formValue: this.workflowForm.value,
      formErrors: this.workflowForm.errors,
      rulesValid: this.rulesFormArray.valid,
      rulesErrors: this.rulesFormArray.errors,
      rulesControls: this.rulesFormArray.controls.map(control => ({
        valid: control.valid,
        errors: control.errors,
        value: control.value
      }))
    });

    if (!this.workflowForm.valid) {
      console.log('Form is invalid, aborting. Marking all fields as touched for error display.');
      this.workflowForm.markAllAsTouched();
      return;
    }

    this.processing.set(true);
    
    try {
      const formValue = this.workflowForm.value;
      const rules = formValue.rules.map((rule: any, index: number) => 
        JSON.stringify({
          id: `rule_${index + 1}`,
          validation: rule.validation,
          action: rule.action
        })
      );

      const workflowData = {
        name: formValue.name,
        description: formValue.description,
        rules: rules,
        actors: this.actors(),
        isActive: formValue.isActive
      };

      console.log('Workflow data to create:', workflowData);

      if (this.currentMode() === 'create') {
        await this.createWorkflow(workflowData);
        console.log('Workflow created successfully');
      } else if (this.currentMode() === 'edit' && this.selectedWorkflow()) {
        await this.updateWorkflow(this.selectedWorkflow()!.id, workflowData);
        console.log('Workflow updated successfully');
      }

      this.closeForm();
      await this.loadWorkflows();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.processing.set(false);
    }
  }

  async createWorkflow(workflow: any) {
    try {
      const client = generateClient<Schema>();
      console.log('Creating workflow with client:', workflow);
      
      const result = await client.models.Workflow.create({
        ...workflow,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      console.log('Workflow creation result:', result);
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  }

  async updateWorkflow(id: string, updates: any) {
    try {
      const client = generateClient<Schema>();
      await client.models.Workflow.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating workflow:', error);
      throw error;
    }
  }

  async deleteWorkflow(workflow: Schema['Workflow']['type']) {
    if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) return;

    this.processing.set(true);
    
    try {
      const client = generateClient<Schema>();
      await client.models.Workflow.delete({ id: workflow.id });
      await this.loadWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
    } finally {
      this.processing.set(false);
    }
  }

  onWorkflowSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value.toLowerCase().trim();
    this.workflowSearchQuery.set(query);
    
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.applyWorkflowSearch();
    }, 300);
  }

  applyWorkflowSearch() {
    const query = this.workflowSearchQuery();
    const allWorkflows = this.workflows().filter(workflow => workflow && workflow.id);
    
    if (!query) {
      this.filteredWorkflows.set(allWorkflows);
    } else {
      const filtered = allWorkflows.filter(workflow =>
        workflow.name?.toLowerCase().includes(query) ||
        workflow.description?.toLowerCase().includes(query)
      );
      this.filteredWorkflows.set(filtered);
    }
  }

  clearWorkflowSearch() {
    this.workflowSearchQuery.set('');
    const allWorkflows = this.workflows().filter(workflow => workflow && workflow.id);
    this.filteredWorkflows.set(allWorkflows);
  }

  trackWorkflowById(index: number, workflow: Schema['Workflow']['type']): string {
    return workflow?.id || index.toString();
  }

  getRuleCount(workflow: Schema['Workflow']['type']): number {
    return workflow.rules ? workflow.rules.length : 0;
  }

  getDocumentTypeCount(workflow: Schema['Workflow']['type']): number {
    if (!workflow.rules) return 0;
    
    const docTypeNames = new Set<string>();
    
    workflow.rules.forEach((ruleString: any) => {
      try {
        const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
        const validation = rule.validation || '';
        const action = rule.action || '';
        
        // Extract document types from validation and action
        this.extractDocTypeNamesFromText(validation, docTypeNames);
        this.extractDocTypeNamesFromText(action, docTypeNames);
      } catch (error) {
        console.error('Error parsing rule for document type count:', ruleString);
      }
    });
    
    return docTypeNames.size;
  }

  getWorkflowRules(workflow: Schema['Workflow']['type']): WorkflowRule[] {
    if (!workflow.rules) return [];
    return (workflow.rules as any[]).map((ruleString: any) => {
      try {
        const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
        return {
          id: rule.id || '',
          validation: rule.validation || '',
          action: rule.action || ''
        };
      } catch (error) {
        console.error('Error parsing rule:', ruleString, error);
        return {
          id: '',
          validation: '',
          action: ''
        };
      }
    });
  }

  onSubmitButtonClick() {
    console.log('Submit button clicked', { 
      valid: this.workflowForm.valid, 
      disabled: !this.workflowForm.valid || this.processing() 
    });
  }

  async loadDocumentTypes() {
    try {
      const client = generateClient<Schema>();
      const { data } = await client.models.DocumentType.list();
      const validDocTypes = data.filter(docType => docType != null);
      this.documentTypes.set(validDocTypes);
      this.filteredDocumentTypes.set(validDocTypes);
      
      // Initialize permissions matrix for new document types
      this.initializePermissionsMatrix();
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
      this.filteredDocumentTypes.set([]);
    }
  }

  async loadProjects() {
    try {
      const client = generateClient<Schema>();
      const { data } = await client.models.Project.list();
      this.projects.set(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects.set([]);
    }
  }

  getProjectCount(workflow: Schema['Workflow']['type']): number {
    if (!workflow.id) return 0;
    
    return this.projects().filter(project => project.workflowId === workflow.id).length;
  }
  
  initializePermissionsMatrix() {
    const currentMatrix = this.permissionsMatrix();
    // Get document types from workflow rules instead of all document types
    const docTypesFromRules = this.extractDocumentTypesFromRules();
    const currentActors = this.actors();
    
    const newMatrix = { ...currentMatrix };
    
    // Initialize matrix for each document type and actor combination
    docTypesFromRules.forEach(docType => {
      if (!newMatrix[docType.id]) {
        newMatrix[docType.id] = {};
      }
      
      currentActors.forEach(actor => {
        if (!newMatrix[docType.id][actor]) {
          // Default permission is 'X' (no access)
          newMatrix[docType.id][actor] = 'X';
        }
      });
    });
    
    this.permissionsMatrix.set(newMatrix);
  }
  
  togglePermission(docTypeId: string, actorName: string) {
    const currentMatrix = this.permissionsMatrix();
    const currentPermission = currentMatrix[docTypeId]?.[actorName] || 'X';
    
    // Cycle through permissions: X -> R -> W -> X
    let newPermission: 'X' | 'R' | 'W';
    switch (currentPermission) {
      case 'X': newPermission = 'R'; break;
      case 'R': newPermission = 'W'; break;
      case 'W': newPermission = 'X'; break;
      default: newPermission = 'X';
    }
    
    const updatedMatrix = {
      ...currentMatrix,
      [docTypeId]: {
        ...currentMatrix[docTypeId],
        [actorName]: newPermission
      }
    };
    
    this.permissionsMatrix.set(updatedMatrix);
  }
  
  getPermission(docTypeId: string, actorName: string): 'X' | 'R' | 'W' {
    return this.permissionsMatrix()[docTypeId]?.[actorName] || 'X';
  }
  
  extractDocumentTypesFromRules(): Array<{id: string, name: string}> {
    const rules = this.rulesFormArray.controls;
    const docTypeNames = new Set<string>();
    
    rules.forEach(ruleControl => {
      const validation = ruleControl.get('validation')?.value || '';
      const action = ruleControl.get('action')?.value || '';
      
      // Extract document types from validation rules
      this.extractDocTypeNamesFromText(validation, docTypeNames);
      
      // Extract document types from action rules  
      this.extractDocTypeNamesFromText(action, docTypeNames);
    });
    
    // Convert to array format expected by permissions matrix
    return Array.from(docTypeNames).map((name, index) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]/g, ''), // Generate consistent ID
      name: name
    }));
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
        // Add spaces before capital letters for display
        const displayName = docTypeName.replace(/([A-Z])/g, ' $1').trim();
        docTypeNames.add(displayName);
      }
    });
  }

  openDocumentTypeSidebar(ruleIndex: number, fieldType: 'validation' | 'action') {
    this.currentRuleIndex.set(ruleIndex);
    this.currentFieldType.set(fieldType);
    this.documentTypeSearchQuery.set('');
    const validDocTypes = this.documentTypes().filter(docType => docType != null);
    this.filteredDocumentTypes.set(validDocTypes);
    this.showDocumentTypeSidebar.set(true);
  }

  closeDocumentTypeSidebar() {
    this.showDocumentTypeSidebar.set(false);
    this.currentRuleIndex.set(-1);
    this.documentTypeSearchQuery.set('');
    this.selectedDocumentTypeForPreview.set(null);
    this.parsedFormFields.set([]);
  }

  onDocumentTypeSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value.trim();
    this.documentTypeSearchQuery.set(query);
    
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Debounce API calls by 300ms
    this.searchTimeout = setTimeout(() => {
      this.applyDocumentTypeSearch();
    }, 300);
  }

  async applyDocumentTypeSearch() {
    const query = this.documentTypeSearchQuery();
    
    try {
      const client = generateClient<Schema>();
      
      if (!query) {
        // Load all document types when no search query
        const { data } = await client.models.DocumentType.list();
        const validDocTypes = data.filter(docType => docType != null);
        this.filteredDocumentTypes.set(validDocTypes);
      } else {
        // Search using API filters
        const { data: nameResults } = await client.models.DocumentType.list({
          filter: {
            name: {
              contains: query
            }
          }
        });

        const { data: definitionResults } = await client.models.DocumentType.list({
          filter: {
            definition: {
              contains: query
            }
          }
        });

        // Combine and deduplicate results
        const allResults = [...nameResults, ...definitionResults];
        const uniqueResults = allResults.filter((docType, index, self) => 
          docType != null && self.findIndex(d => d?.id === docType.id) === index
        );
        
        this.filteredDocumentTypes.set(uniqueResults);
      }
    } catch (error) {
      console.error('Error searching document types:', error);
      // Fallback to local filtering if API search fails
      const allDocTypes = this.documentTypes();
      if (!query) {
        const validDocTypes = allDocTypes.filter(docType => docType != null);
        this.filteredDocumentTypes.set(validDocTypes);
      } else {
        const filtered = allDocTypes.filter(docType =>
          docType && (
            docType.name?.toLowerCase().includes(query.toLowerCase()) ||
            docType.definition?.toLowerCase().includes(query.toLowerCase())
          )
        );
        this.filteredDocumentTypes.set(filtered);
      }
    }
  }

  selectDocumentType(documentType: Schema['DocumentType']['type']) {
    // Parse and show the document type form fields in the sidebar
    this.selectedDocumentTypeForPreview.set(documentType);
    try {
      const definition = JSON.parse(documentType.definition || '{}');
      const fields = definition.fields || [];
      this.parsedFormFields.set(fields);
    } catch (error) {
      console.error('Error parsing document type definition:', error);
      this.parsedFormFields.set([]);
    }
  }

  async openLeftSidebar() {
    if (this.documentTypes().length === 0) {
      await this.loadDocumentTypes();
    }
    this.showLeftSidebar.set(true);
  }

  closeLeftSidebar() {
    this.showLeftSidebar.set(false);
    this.selectedDocumentTypeForPreview.set(null);
    this.parsedFormFields.set([]);
  }

  openDocumentTypePreview(documentType: Schema['DocumentType']['type']) {
    this.selectedDocumentTypeForPreview.set(documentType);
    try {
      const definition = JSON.parse(documentType.definition || '{}');
      const fields = definition.fields || [];
      this.parsedFormFields.set(fields);
    } catch (error) {
      console.error('Error parsing document type definition:', error);
      this.parsedFormFields.set([]);
    }
  }

  generateFlowchart() {
    const rules = this.rulesFormArray.controls;
    const nodes: any[] = [];
    const connections: any[] = [];
    
    if (rules.length === 0) {
      this.flowchartNodes.set([]);
      this.flowchartConnections.set([]);
      this.flowchartViewBox.set('0 0 600 400');
      return;
    }

    // Extract all document types from all rules (including multi-node validations)
    const allDocTypes = new Set<string>();
    const ruleConnections: { from: string[], to: string[], ruleIndex: number }[] = [];
    
    rules.forEach((rule, index) => {
      const validation = rule.get('validation')?.value || '';
      const action = rule.get('action')?.value || '';
      
      // Extract ALL document types from validation (supports multi-node conditions)
      const validationDocTypes = this.extractAllDocumentTypeNames(validation);
      const actionDocTypes = this.extractAllDocumentTypeNames(action);
      
      // Add all document types to the set
      validationDocTypes.forEach(docType => allDocTypes.add(docType));
      actionDocTypes.forEach(docType => allDocTypes.add(docType));
      
      // Create connections from all validation nodes to all action nodes
      if (validationDocTypes.length > 0 && actionDocTypes.length > 0) {
        ruleConnections.push({
          from: validationDocTypes,
          to: actionDocTypes,
          ruleIndex: index
        });
      }
    });

    if (allDocTypes.size === 0) {
      this.flowchartNodes.set([]);
      this.flowchartConnections.set([]);
      this.flowchartViewBox.set('0 0 600 400');
      return;
    }

    // Use topological sorting to determine proper column layout
    const columns = this.calculateNodeColumns(Array.from(allDocTypes), ruleConnections);

    // Create nodes with proper column/row positioning
    const nodeWidth = 200;
    const nodeHeight = 120;
    const startX = 50;
    const startY = 50;
    
    columns.forEach((column, colIndex) => {
      column.forEach((docType, rowIndex) => {
        const wrappedText = this.wrapText(docType, 16);
        const dynamicHeight = Math.max(60, 40 + (wrappedText.length * 12));
        
        // Determine node type based on connections
        const hasIncoming = ruleConnections.some(rule => rule.to.includes(docType));
        const hasOutgoing = ruleConnections.some(rule => rule.from.includes(docType));
        
        let nodeType = 'middle';
        if (!hasIncoming && hasOutgoing) nodeType = 'start';
        else if (hasIncoming && !hasOutgoing) nodeType = 'end';
        
        // Check if this document type exists in our document types list
        const isInvalid = !this.documentTypes().some(dt => dt.name === docType || dt.identifier === docType);
        
        nodes.push({
          id: `${docType}`,
          position: { 
            x: startX + (colIndex * nodeWidth), 
            y: startY + (rowIndex * nodeHeight)
          },
          data: { 
            label: docType,
            wrappedText: wrappedText,
            height: dynamicHeight,
            type: nodeType,
            docType: docType,
            column: colIndex,
            row: rowIndex,
            isInvalid: isInvalid
          }
        });
      });
    });

    // Create connections for each rule (many-to-many)
    ruleConnections.forEach((rule, ruleIndex) => {
      rule.from.forEach(fromDocType => {
        rule.to.forEach(toDocType => {
          const fromNode = nodes.find(n => n.data.docType === fromDocType);
          const toNode = nodes.find(n => n.data.docType === toDocType);
          
          if (fromNode && toNode && fromDocType !== toDocType) {
            connections.push({
              id: `connection-${ruleIndex}-${fromDocType}-${toDocType}`,
              fOutputId: fromNode.id,
              fInputId: toNode.id,
              ruleIndex: ruleIndex
            });
          }
        });
      });
    });

    // Calculate dynamic viewBox based on actual node positions
    const maxX = Math.max(600, ...nodes.map(n => n.position.x + 140)); // Node width is 140
    const maxY = Math.max(400, ...nodes.map(n => n.position.y + n.data.height));
    
    const chartWidth = maxX + 100; // Add padding
    const chartHeight = maxY + 100; // Add padding
    
    this.flowchartViewBox.set(`0 0 ${chartWidth} ${chartHeight}`);

    this.flowchartNodes.set(nodes);
    this.flowchartConnections.set(connections);
  }

  private extractDocumentTypeName(text: string): string {
    // Extract document type name from patterns like:
    // "document.BuildingPermit" -> "BuildingPermit"
    // "process.BusinessLicense" -> "BusinessLicense"
    const match = text.match(/(?:document)\.(\w+)/);
    if (match) {
      // Find the document type by identifier and return its name
      const identifier = match[1];
      const docType = this.documentTypes().find(dt => dt.identifier === identifier);
      return docType?.name || identifier;
    }
    return '';
  }

  private extractAllDocumentTypeNames(text: string): string[] {
    // Extract ALL document type names and field names from patterns like:
    // "document.LandSalesContract.status in ("completed","notrequired")" and "notrequired.value == false"
    const docTypes: string[] = [];
    const invalidTypes = new Set(this.invalidDocumentTypes());
    
    // Extract document types
    const documentMatches = text.matchAll(/(?:document)\.(\w+)/g);
    for (const match of documentMatches) {
      const identifier = match[1];
      const docType = this.documentTypes().find(dt => dt.identifier === identifier);
      const name = docType?.name || identifier;
      
      // Track invalid document types
      if (!docType) {
        invalidTypes.add(identifier);
      }
      
      // Avoid duplicates
      if (!docTypes.includes(name)) {
        docTypes.push(name);
      }
    }
    
    // Extract field names (e.g., notrequired, status, hidden)
    const fieldMatches = text.matchAll(/(\w+)\.(\w+)/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      // Skip document references as they're handled above
      if (fieldName !== 'document' && fieldName !== 'process') {
        // Avoid duplicates
        if (!docTypes.includes(fieldName)) {
          docTypes.push(fieldName);
        }
      }
    }
    
    // Update invalid document types signal
    this.invalidDocumentTypes.set(invalidTypes);
    
    return docTypes;
  }

  private calculateNodeColumns(allDocTypes: string[], ruleConnections: { from: string[], to: string[], ruleIndex: number }[]): string[][] {
    // Create adjacency list for the graph
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    
    // Initialize all nodes
    allDocTypes.forEach(docType => {
      graph.set(docType, new Set());
      inDegree.set(docType, 0);
    });
    
    // Build graph from rule connections
    ruleConnections.forEach(rule => {
      rule.from.forEach(fromNode => {
        rule.to.forEach(toNode => {
          if (fromNode !== toNode) {
            if (!graph.get(fromNode)!.has(toNode)) {
              graph.get(fromNode)!.add(toNode);
              inDegree.set(toNode, (inDegree.get(toNode) || 0) + 1);
            }
          }
        });
      });
    });
    
    // Topological sort using Kahn's algorithm
    const queue: string[] = [];
    const columns: string[][] = [];
    const nodeColumns = new Map<string, number>();
    
    // Start with nodes that have no incoming edges
    allDocTypes.forEach(docType => {
      if (inDegree.get(docType) === 0) {
        queue.push(docType);
        nodeColumns.set(docType, 0);
      }
    });
    
    let currentColumn = 0;
    
    while (queue.length > 0) {
      // Process all nodes in current column
      const currentLevelNodes = [...queue];
      queue.length = 0;
      
      if (currentLevelNodes.length > 0) {
        if (!columns[currentColumn]) {
          columns[currentColumn] = [];
        }
        columns[currentColumn].push(...currentLevelNodes);
        
        // Process neighbors
        currentLevelNodes.forEach(node => {
          const neighbors = graph.get(node) || new Set();
          neighbors.forEach(neighbor => {
            inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
            
            if (inDegree.get(neighbor) === 0) {
              queue.push(neighbor);
              const neighborColumn = Math.max(
                currentColumn + 1,
                nodeColumns.get(neighbor) || 0
              );
              nodeColumns.set(neighbor, neighborColumn);
            }
          });
        });
        
        currentColumn++;
      }
    }
    
    // Handle any remaining nodes (cycles or isolated nodes)
    allDocTypes.forEach(docType => {
      if (!nodeColumns.has(docType)) {
        if (!columns[currentColumn]) {
          columns[currentColumn] = [];
        }
        columns[currentColumn].push(docType);
        nodeColumns.set(docType, currentColumn);
      }
    });
    
    // Reorganize nodes by their calculated columns
    const finalColumns: string[][] = [];
    const maxCol = Math.max(...Array.from(nodeColumns.values()));
    
    for (let i = 0; i <= maxCol; i++) {
      finalColumns[i] = [];
    }
    
    allDocTypes.forEach(docType => {
      const col = nodeColumns.get(docType) || 0;
      finalColumns[col].push(docType);
    });
    
    return finalColumns.filter(col => col.length > 0);
  }

  private wrapText(text: string, maxCharsPerLine: number): string[] {
    if (text.length <= maxCharsPerLine) {
      return [text];
    }
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        // If single word is longer than max, truncate it
        if (word.length > maxCharsPerLine) {
          lines.push(word.substring(0, maxCharsPerLine - 3) + '...');
        } else {
          currentLine = word;
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.length > 0 ? lines : [text];
  }

  getNodePosition(nodeId: string): { x: number, y: number } {
    const node = this.flowchartNodes().find(n => n.id === nodeId);
    return node ? node.position : { x: 0, y: 0 };
  }

  getNodeCenter(nodeId: string): { x: number, y: number } {
    const node = this.flowchartNodes().find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    
    const centerY = node.position.y + (node.data.height || 60) / 2;
    return { 
      x: node.position.x + 70, // Center of 140px width
      y: centerY
    };
  }

  getNodeRightEdge(nodeId: string): { x: number, y: number } {
    const center = this.getNodeCenter(nodeId);
    return { x: center.x + 70, y: center.y };
  }

  getNodeLeftEdge(nodeId: string): { x: number, y: number } {
    const center = this.getNodeCenter(nodeId);
    return { x: center.x - 70, y: center.y };
  }

  onDragStart(event: DragEvent, field: any, prefix: string) {
    if (event.dataTransfer) {
      const identifier = this.selectedDocumentTypeForPreview()?.identifier || this.selectedDocumentTypeForPreview()?.name;
      const dragData = `${prefix}.${identifier}.${field.key}`;
      event.dataTransfer.setData('text/plain', dragData);
      event.dataTransfer.effectAllowed = 'copy';
    }
  }
  
  onDocumentTypeDragStart(event: DragEvent, docType: Schema['DocumentType']['type']) {
    if (event.dataTransfer) {
      // Generate identifier from name if not available
      let identifier = docType.identifier;
      if (!identifier) {
        identifier = docType.name?.replace(/[^a-zA-Z0-9]/g, '') || 'DocumentType';
      }
      
      const dragData = `${identifier}.status`;  // Default to .status property
      event.dataTransfer.setData('text/plain', dragData);
      event.dataTransfer.effectAllowed = 'copy';
      console.log('Dragging document type:', dragData, 'from docType:', docType);
      
      // Prevent click from firing when dragging
      event.stopPropagation();
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    const target = event.target as HTMLElement;
    target.classList.add('dragover');
  }

  onDragLeave(event: DragEvent) {
    const target = event.target as HTMLElement;
    target.classList.remove('dragover');
  }

  onDrop(event: DragEvent, ruleIndex: number, fieldType: 'validation' | 'action') {
    event.preventDefault();
    const target = event.target as HTMLElement;
    target.classList.remove('dragover');
    
    const dragData = event.dataTransfer?.getData('text/plain');
    console.log('Drop event received:', {dragData, ruleIndex, fieldType});
    
    if (dragData && ruleIndex >= 0 && ruleIndex < this.rulesFormArray.length) {
      const ruleControl = this.rulesFormArray.at(ruleIndex);
      const currentValue = ruleControl.get(fieldType)?.value || '';
      const newValue = currentValue ? `${currentValue}\n${dragData}` : dragData;
      
      if (fieldType === 'validation') {
        ruleControl.patchValue({ validation: newValue });
      } else {
        ruleControl.patchValue({ action: newValue });
      }
    }
  }

  zoomIn() {
    const currentZoom = this.zoomLevel();
    const newZoom = Math.min(currentZoom * 1.2, 3); // Max zoom 3x
    this.zoomLevel.set(newZoom);
  }

  zoomOut() {
    const currentZoom = this.zoomLevel();
    const newZoom = Math.max(currentZoom / 1.2, 0.3); // Min zoom 0.3x
    this.zoomLevel.set(newZoom);
  }

  resetZoom() {
    this.zoomLevel.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  fitToScreen() {
    if (this.flowchartNodes().length === 0) return;
    
    // Calculate the bounding box of all nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    this.flowchartNodes().forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      const width = 140;
      const height = node.data.height || 60;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + height);
    });
    
    // Add padding
    const padding = 50;
    const contentWidth = maxX - minX + (padding * 2);
    const contentHeight = maxY - minY + (padding * 2);
    
    // Calculate zoom to fit content in container (assuming 600x300 visible area)
    const containerWidth = 580; // Account for scrollbars
    const containerHeight = 280;
    
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const optimalZoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x
    
    this.zoomLevel.set(optimalZoom);
    
    // Center the content
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    this.panX.set(-centerX * optimalZoom + containerWidth / 2);
    this.panY.set(-centerY * optimalZoom + containerHeight / 2);
  }

  onFlowchartWheel(event: WheelEvent) {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? -1 : 1;
    const zoomFactor = 1 + (delta * 0.1);
    const currentZoom = this.zoomLevel();
    const newZoom = Math.max(0.3, Math.min(3, currentZoom * zoomFactor));
    
    this.zoomLevel.set(newZoom);
  }

  onFlowchartMouseDown(event: MouseEvent) {
    event.preventDefault();
    // Could add drag-to-pan functionality here if needed
  }

  highlightAndScrollToRule(ruleIndex: number) {
    // Highlight the rule
    this.highlightedRuleIndex.set(ruleIndex);
    
    // Scroll to the rule in the rules list
    setTimeout(() => {
      const ruleElement = document.querySelector(`#rule-${ruleIndex}`);
      if (ruleElement) {
        ruleElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 100);
    
    // Clear highlight after 3 seconds
    setTimeout(() => {
      this.highlightedRuleIndex.set(null);
    }, 3000);
  }

  isDocumentTypeInvalid(identifier: string): boolean {
    return this.invalidDocumentTypes().has(identifier);
  }

  hasInvalidDocumentTypes(text: string): boolean {
    const matches = text.matchAll(/(?:document)\.(\w+)/g);
    for (const match of matches) {
      const identifier = match[1];
      const docType = this.documentTypes().find(dt => dt.identifier === identifier);
      if (!docType) {
        return true;
      }
    }
    return false;
  }


  addActor() {
    const actorName = this.newActorName().trim();
    if (actorName && !this.actors().includes(actorName.toLowerCase())) {
      this.actors.update(current => [...current, actorName.toLowerCase()]);
      this.newActorName.set('');
      // Reinitialize permissions matrix with new actor
      this.initializePermissionsMatrix();
    }
  }

  removeActor(index: number) {
    if (index >= 0 && index < this.actors().length) {
      const removedActor = this.actors()[index];
      this.actors.update(current => current.filter((_, i) => i !== index));
      
      // Remove actor from permissions matrix
      const currentMatrix = this.permissionsMatrix();
      const updatedMatrix = { ...currentMatrix };
      Object.keys(updatedMatrix).forEach(docTypeId => {
        delete updatedMatrix[docTypeId][removedActor];
      });
      this.permissionsMatrix.set(updatedMatrix);
    }
  }

  onActorInputKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addActor();
    }
  }

  getFormFieldValues(): { [key: string]: any } {
    const values: { [key: string]: any } = {};
    
    // Create mock form field values for testing workflow rules
    // Based on common field patterns found in validation rules
    
    // Mock checkbox fields
    values['notrequired.value'] = Math.random() > 0.5; // Boolean for checkbox
    values['required.value'] = Math.random() > 0.5;
    
    // Mock visibility states
    values['notes.hidden'] = false;
    values['files.hidden'] = false;
    values['status.hidden'] = false;
    
    // Mock other common field values
    values['status.value'] = ['queued', 'waiting', 'completed'][Math.floor(Math.random() * 3)];
    values['notes.value'] = 'Test notes content';
    
    return values;
  }

  executeWorkflowActions(actions: string[], fieldValues: { [key: string]: any }): { [key: string]: any } {
    const updatedValues = { ...fieldValues };
    
    actions.forEach(action => {
      // Handle field property assignment: fieldName.property = value
      const actionMatch = action.match(/(\w+)\.(\w+)\s*=\s*(true|false|["']([^"']+)["']|\d+)/);
      if (actionMatch) {
        const [, fieldName, property, rawValue] = actionMatch;
        
        // Parse the value
        let actionValue: any = rawValue;
        if (rawValue === 'true') actionValue = true;
        else if (rawValue === 'false') actionValue = false;
        else if (rawValue === '"true"' || rawValue === "'true'") actionValue = true;
        else if (rawValue === '"false"' || rawValue === "'false'") actionValue = false;
        else if (rawValue.match(/^\d+$/)) actionValue = parseInt(rawValue);
        else if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
          actionValue = rawValue.slice(1, -1);
        }
        
        const fieldKey = `${fieldName}.${property}`;
        updatedValues[fieldKey] = actionValue;
        console.log(`ACTION EXECUTED: Set ${fieldKey} = ${actionValue} (type: ${typeof actionValue})`);
      } else {
        console.warn(`Unrecognized action format: ${action}`);
      }
    });
    
    return updatedValues;
  }

  // Workflow validation evaluation engine
  evaluateWorkflowCondition(condition: string, documentStatuses: Map<string, string>): boolean {
    try {
      // Handle multi-line conditions with 'and' operators
      const lines = condition.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
      
      // If multiple lines, treat as AND conditions
      if (lines.length > 1) {
        console.log(`Evaluating multi-line AND condition with ${lines.length} parts`);
        return lines.every(line => this.evaluateSingleWorkflowCondition(line, documentStatuses));
      }
      
      // Handle single line with 'and' operators
      if (condition.includes(' and ')) {
        const andParts = condition.split(' and ').map(part => part.trim());
        console.log(`Evaluating single-line AND condition with ${andParts.length} parts`);
        return andParts.every(part => this.evaluateSingleWorkflowCondition(part, documentStatuses));
      }
      
      // Single condition
      return this.evaluateSingleWorkflowCondition(condition, documentStatuses);
    } catch (error) {
      console.error('Error evaluating workflow condition:', error);
      return false;
    }
  }

  private evaluateSingleWorkflowCondition(condition: string, documentStatuses: Map<string, string>): boolean {
    // Handle 'in' operator: document.Type.status in ("value1","value2")
    const inMatch = condition.match(/(document)\.(\w+)\.status\s+in\s*\(([^)]+)\)/);
    if (inMatch) {
      const [, prefix, documentType, valuesStr] = inMatch;
      const allowedValues = valuesStr.split(',').map(v => v.trim().replace(/['"]/g, ''));
      
      const statusKey = `${prefix}.${documentType}`;
      const currentStatus = documentStatuses.get(statusKey) || '';
      
      const result = allowedValues.includes(currentStatus);
      console.log(`IN condition: ${statusKey} status="${currentStatus}" in [${allowedValues.join(', ')}] = ${result}`);
      return result;
    }

    // Handle equality operator: document.Type.status == "value"
    const documentEqualityMatch = condition.match(/(document)\.(\w+)\.status\s*([=!<>]+)\s*["']([^"']+)["']/);
    if (documentEqualityMatch) {
      const [, prefix, documentType, operator, expectedValue] = documentEqualityMatch;
      const statusKey = `${prefix}.${documentType}`;
      const currentStatus = documentStatuses.get(statusKey) || '';
      
      let result = false;
      switch (operator) {
        case '==':
        case '=':
          result = currentStatus === expectedValue;
          break;
        case '!=':
          result = currentStatus !== expectedValue;
          break;
        default:
          console.error(`Unsupported operator: ${operator}`);
          return false;
      }
      
      console.log(`EQUALITY condition: ${statusKey} status="${currentStatus}" ${operator} "${expectedValue}" = ${result}`);
      return result;
    }

    // Handle field property equality: fieldName.property == value
    const fieldPropertyMatch = condition.match(/(\w+)\.(\w+)\s*([=!<>]+)\s*(true|false|["']([^"']+)["']|\d+)/);
    if (fieldPropertyMatch) {
      const [, fieldName, property, operator, rawValue] = fieldPropertyMatch;
      
      // Parse the value
      let expectedValue: any = rawValue;
      if (rawValue === 'true') expectedValue = 'true';
      else if (rawValue === 'false') expectedValue = 'false';
      else if (rawValue === '"true"' || rawValue === "'true'") expectedValue = 'true';
      else if (rawValue === '"false"' || rawValue === "'false'") expectedValue = 'false';
      else if (rawValue.match(/^\d+$/)) expectedValue = parseInt(rawValue);
      else if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
        expectedValue = rawValue.slice(1, -1);
      }
      
      const fieldKey = `${fieldName}.${property}`;
      const currentValue = documentStatuses.get(fieldKey);
      
      let result = false;
      switch (operator) {
        case '==':
        case '=':
          // Handle boolean comparisons specially
          if (typeof currentValue === 'boolean' || typeof expectedValue === 'boolean') {
            // Convert both to boolean for comparison
            const currentBool = (currentValue as any) === true || currentValue === 'true';
            const expectedBool = (expectedValue as any) === true || expectedValue === 'true';
            result = currentBool === expectedBool;
          } else {
            result = currentValue == expectedValue;
          }
          break;
        case '!=':
          // Handle boolean comparisons specially
          if (typeof currentValue === 'boolean' || typeof expectedValue === 'boolean') {
            const currentBool = (currentValue as any) === true || currentValue === 'true';
            const expectedBool = (expectedValue as any) === true || expectedValue === 'true';
            result = currentBool !== expectedBool;
          } else {
            result = currentValue != expectedValue;
          }
          break;
        default:
          console.error(`Unsupported operator: ${operator}`);
          return false;
      }
      
      console.log(`FIELD PROPERTY condition: ${fieldKey} value="${currentValue}" (type: ${typeof currentValue}) ${operator} ${expectedValue} (type: ${typeof expectedValue}) = ${result}`);
      console.log(`Raw condition: "${condition}", Raw value captured: "${rawValue}"`);
      return result;
    }

    console.warn(`Unrecognized condition format: ${condition}`);
    return false;
  }

  // Test workflow validation with actual form data
  testWorkflowValidation() {
    const rules = this.rulesFormArray.controls;
    if (rules.length === 0) {
      alert('No rules to test. Please add some workflow rules first.');
      return;
    }

    // Get actual form field values from the document type form
    const fieldValues = this.getFormFieldValues();
    
    // Create mock document statuses for testing
    const mockStatuses = new Map<string, string>();
    
    // Add form field values to the status map
    Object.entries(fieldValues).forEach(([key, value]) => {
      mockStatuses.set(key, String(value));
    });
    
    // Extract all document references and field properties from rules and create mock data
    rules.forEach(rule => {
      const validation = rule.get('validation')?.value || '';
      const action = rule.get('action')?.value || '';
      
      // Extract document types from validation and action
      const docMatches = [...validation.matchAll(/(document)\.(\w+)/g), ...action.matchAll(/(document)\.(\w+)/g)];
      
      docMatches.forEach(match => {
        const key = `${match[1]}.${match[2]}`;
        if (!mockStatuses.has(key)) {
          // Set random status for testing
          const statuses = ['waiting', 'completed', 'notrequired', 'received'];
          mockStatuses.set(key, statuses[Math.floor(Math.random() * statuses.length)]);
        }
      });

    });

    // Evaluate each rule and execute actions
    const results: { ruleIndex: number, validation: string, result: boolean, action?: string, executed?: boolean }[] = [];
    let currentFieldValues = { ...fieldValues };
    
    rules.forEach((rule, index) => {
      const validation = rule.get('validation')?.value || '';
      const action = rule.get('action')?.value || '';
      
      if (validation) {
        // Update mockStatuses with current field values for this evaluation
        Object.entries(currentFieldValues).forEach(([key, value]) => {
          mockStatuses.set(key, String(value));
        });
        
        const result = this.evaluateWorkflowCondition(validation, mockStatuses);
        
        let executed = false;
        if (result && action) {
          // Execute the action
          const actionLines = action.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
          currentFieldValues = this.executeWorkflowActions(actionLines, currentFieldValues);
          executed = true;
        }
        
        results.push({
          ruleIndex: index + 1,
          validation: validation,
          result: result,
          action: result ? action : undefined,
          executed: executed
        });
      }
    });

    // Display results
    const passedRules = results.filter(r => r.result).length;
    const totalRules = results.length;
    
    let message = `Workflow Validation Test Results:\n\n`;
    
    message += `Initial Field Values:\n`;
    Object.entries(fieldValues).forEach(([key, value]) => {
      message += `  ${key}: ${value} (${typeof value})\n`;
    });
    
    message += `\nFinal Field Values (after actions):\n`;
    Object.entries(currentFieldValues).forEach(([key, value]) => {
      const changed = fieldValues[key] !== value ? ' ← CHANGED' : '';
      message += `  ${key}: ${value} (${typeof value})${changed}\n`;
    });
    
    message += `\nMock Document Statuses:\n`;
    Array.from(mockStatuses.entries()).forEach(([key, status]) => {
      if (key.includes('document.')) {
        message += `  ${key}: ${status}\n`;
      }
    });
    
    message += `\nRule Evaluation (${passedRules}/${totalRules} passed):\n`;
    results.forEach(result => {
      const status = result.result ? '✅ PASS' : '❌ FAIL';
      const executedText = result.executed ? ' (ACTION EXECUTED)' : '';
      message += `  Rule ${result.ruleIndex}: ${status}${executedText}\n`;
      message += `    Condition: ${result.validation}\n`;
      if (result.action) {
        message += `    → Action: ${result.action}\n`;
      }
      message += '\n';
    });

    alert(message);
  }
}