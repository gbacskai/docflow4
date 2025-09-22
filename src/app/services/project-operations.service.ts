import { Injectable, inject } from '@angular/core';
import type { Schema } from '../../../amplify/data/resource';
import { VersionedDataService } from './versioned-data.service';
import { DynamicFormService } from './dynamic-form.service';
import { WorkflowService } from './workflow.service';

export interface ProjectOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectOperationsService {
  private versionedDataService = inject(VersionedDataService);
  private dynamicFormService = inject(DynamicFormService);
  private workflowService = inject(WorkflowService);

  /**
   * Create a new project with complete document creation, validation, and workflow processing
   */
  async createProject(
    projectData: any,
    workflows: Array<Schema['Workflow']['type']>,
    documentTypes: Array<Schema['DocumentType']['type']>
  ): Promise<ProjectOperationResult> {
    try {
      console.log('🚀 Creating project with enhanced processing:', projectData);
      
      // 1. Create the project
      const projectResult = await this.versionedDataService.createVersionedRecord('Project', {
        data: { ...projectData }
      });
      
      if (!projectResult.success) {
        throw new Error(projectResult.error || 'Failed to create project');
      }
      
      const createdProject = projectResult.data;
      console.log('✅ Project created:', createdProject);

      // 2. Create all required documents
      await this.createProjectDocuments(createdProject.id, projectData.workflowId, workflows, documentTypes);
      
      return { success: true, data: createdProject };
      
    } catch (error) {
      console.error('❌ Error in enhanced project creation:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update a project with document creation, validation, and workflow processing
   */
  async updateProject(
    projectId: string,
    updates: any,
    workflows: Array<Schema['Workflow']['type']>,
    documentTypes: Array<Schema['DocumentType']['type']>,
    existingDocuments: Array<Schema['Document']['type']>
  ): Promise<ProjectOperationResult> {
    try {
      console.log('🔄 Updating project with enhanced processing:', projectId, updates);
      
      // 1. Update the project
      const result = await this.versionedDataService.updateVersionedRecord('Project', projectId, updates);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update project');
      }
      
      // 2. Create missing documents (don't modify existing ones)
      await this.createMissingDocuments(projectId, updates.workflowId, workflows, documentTypes, existingDocuments);
      
      // 3. Execute workflow rules
      await this.executeWorkflowRules(projectId);
      
      return { success: true, data: result.data };
      
    } catch (error) {
      console.error('❌ Error in enhanced project update:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Create all documents for a new project (with validation and workflow processing)
   */
  private async createProjectDocuments(
    projectId: string,
    workflowId: string | undefined,
    workflows: Array<Schema['Workflow']['type']>,
    documentTypes: Array<Schema['DocumentType']['type']>
  ) {
    // Get document types that should exist for this project
    const requiredDocumentTypes = this.getRequiredDocumentTypes(workflowId, workflows, documentTypes);
    
    if (requiredDocumentTypes.length === 0) {
      console.log('📋 No document types to create for project');
      return;
    }
    
    console.log(`📋 Creating ${requiredDocumentTypes.length} documents for new project`);
    
    // Create documents with validation and initial processing
    await this.createDocumentsWithValidation(projectId, requiredDocumentTypes);
    
    // Execute workflow rules after all documents are created and validated
    await this.executeWorkflowRules(projectId);
  }

  /**
   * Create missing documents for project update (only create what doesn't exist)
   */
  private async createMissingDocuments(
    projectId: string,
    workflowId: string | undefined,
    workflows: Array<Schema['Workflow']['type']>,
    documentTypes: Array<Schema['DocumentType']['type']>,
    existingDocuments: Array<Schema['Document']['type']>
  ) {
    // Get document types that should exist
    const requiredDocumentTypes = this.getRequiredDocumentTypes(workflowId, workflows, documentTypes);
    
    // Filter out document types that already exist
    const existingDocumentTypeIds = new Set(existingDocuments.map(doc => doc.documentType));
    const missingDocumentTypes = requiredDocumentTypes.filter(docType => 
      !existingDocumentTypeIds.has(docType.id!)
    );
    
    if (missingDocumentTypes.length === 0) {
      console.log('📋 No missing documents to create - all required document types already exist');
      return;
    }
    
    console.log(`📋 Creating ${missingDocumentTypes.length} missing documents for project update`);
    
    // Create missing documents with validation
    await this.createDocumentsWithValidation(projectId, missingDocumentTypes);
  }

  /**
   * Get all required document types for a project based on workflow and validation rules
   */
  private getRequiredDocumentTypes(
    workflowId: string | undefined,
    workflows: Array<Schema['Workflow']['type']>,
    documentTypes: Array<Schema['DocumentType']['type']>
  ): Array<Schema['DocumentType']['type']> {
    console.log(`🔍 Getting required document types for workflowId: ${workflowId}`);
    console.log(`🔍 Total available document types: ${documentTypes.length}`);
    
    // If no workflow selected, return empty array
    if (!workflowId) {
      console.warn(`⚠️ No workflow selected. No documents will be created.`);
      return [];
    }
    
    // Find the selected workflow
    const selectedWorkflow = workflows.find(w => w.id === workflowId);
    if (!selectedWorkflow) {
      console.warn(`⚠️ Workflow not found: ${workflowId}. No documents will be created.`);
      return [];
    }
    
    console.log(`🔍 Found workflow: ${selectedWorkflow.name}`);
    
    // Extract document types referenced in workflow rules
    const workflowDocTypes = this.extractDocumentTypesFromWorkflow(selectedWorkflow, documentTypes);
    
    // Also extract document types from DocumentType validation rules
    const allReferencedTypes = new Set<string>();
    
    // Add workflow-referenced types
    workflowDocTypes.forEach(dt => allReferencedTypes.add(dt.id!));
    
    // Also scan DocumentType validation rules for cross-references
    documentTypes.filter(dt => dt.isActive !== false).forEach(docType => {
      const docTypeWithRules = docType as any;
      if (docTypeWithRules.validationRules) {
        const crossReferencedTypes = this.extractDocumentTypesFromValidationRules(
          docTypeWithRules.validationRules,
          documentTypes
        );
        crossReferencedTypes.forEach(dt => allReferencedTypes.add(dt.id!));
      }
    });
    
    // Get final list of required document types
    const requiredTypes = documentTypes.filter(dt => 
      dt.isActive !== false && allReferencedTypes.has(dt.id!)
    );
    
    console.log(`🔍 Selected ${requiredTypes.length} workflow-required document types:`, 
      requiredTypes.map(dt => dt.name).join(', '));
    
    // If no document types found in workflow rules, log warning but don't create all types
    if (requiredTypes.length === 0) {
      console.warn(`⚠️ No document types found in workflow rules for "${selectedWorkflow.name}". ` +
        `Check that the workflow rules reference document types by their identifier.`);
    }
    
    return requiredTypes;
  }

  /**
   * Extract document types referenced in workflow rules
   */
  private extractDocumentTypesFromWorkflow(
    workflow: Schema['Workflow']['type'],
    documentTypes: Array<Schema['DocumentType']['type']>
  ): Array<Schema['DocumentType']['type']> {
    const referencedTypes = new Set<string>();
    
    if (!workflow.rules || workflow.rules.length === 0) {
      return [];
    }
    
    workflow.rules.forEach((ruleString: any) => {
      try {
        const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
        const validation = rule.validation || '';
        const action = rule.action || '';
        
        // Extract document type references from validation and action
        documentTypes.forEach(docType => {
          if (docType.identifier) {
            if (validation.includes(docType.identifier) || action.includes(docType.identifier)) {
              referencedTypes.add(docType.id!);
            }
          }
        });
      } catch (error) {
        console.warn('Failed to parse workflow rule:', ruleString, error);
      }
    });
    
    return documentTypes.filter(dt => referencedTypes.has(dt.id!));
  }

  /**
   * Extract document types referenced in DocumentType validation rules
   */
  private extractDocumentTypesFromValidationRules(
    validationRules: string,
    documentTypes: Array<Schema['DocumentType']['type']>
  ): Array<Schema['DocumentType']['type']> {
    const referencedTypes = new Set<string>();
    
    // Parse validation rules and look for document type references
    const lines = validationRules.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      documentTypes.forEach(docType => {
        if (docType.identifier && line.includes(docType.identifier)) {
          referencedTypes.add(docType.id!);
        }
      });
    }
    
    return documentTypes.filter(dt => referencedTypes.has(dt.id!));
  }

  /**
   * Create documents with validation and initial status calculation
   */
  private async createDocumentsWithValidation(
    projectId: string,
    documentTypes: Array<Schema['DocumentType']['type']>
  ) {
    const results = [];
    let successCount = 0;
    
    console.log(`📋 Starting sequential creation of ${documentTypes.length} documents`);
    
    // Process documents sequentially to avoid race conditions
    for (const docType of documentTypes) {
      try {
        console.log(`📄 Creating document for type: ${docType.name}`);
        
        // Parse document type definition to create initial form data
        let initialFormData: any = {};
        if (docType.definition) {
          try {
            const definition = JSON.parse(docType.definition);
            if (definition.fields && Array.isArray(definition.fields)) {
              definition.fields.forEach((field: any) => {
                if (field.defaultValue !== undefined) {
                  initialFormData[field.name] = field.defaultValue;
                } else if (field.type === 'boolean' || field.type === 'checkbox') {
                  initialFormData[field.name] = false;
                } else {
                  initialFormData[field.name] = undefined;
                }
              });
            }
          } catch (parseError) {
            console.warn(`Failed to parse definition for ${docType.name}:`, parseError);
          }
        }
        
        // Apply DocumentType validation rules if they exist
        if (docType.validationRules && docType.validationRules.trim()) {
          console.log(`🔍 Applying DocumentType validation rules for: ${docType.name}`);
          initialFormData = await this.applyDocumentTypeValidationRules(initialFormData, docType, docType.validationRules);
        }
        
        // Calculate initial status
        const initialStatus = this.calculateDocumentStatus(initialFormData);
        const finalFormData = { ...initialFormData, status: initialStatus };
        
        // Create the document
        const result = await this.versionedDataService.createVersionedRecord('Document', {
          data: {
            projectId: projectId,
            documentType: docType.id,
            formData: JSON.stringify(finalFormData),
          }
        });
        
        results.push(result);
        if (result.success) {
          successCount++;
          console.log(`✅ Successfully created document for: ${docType.name}`);
        } else {
          console.error(`❌ Failed to create document for: ${docType.name}`, result.error);
        }
        
      } catch (error) {
        console.error(`❌ Error creating document for ${docType.name}:`, error);
        const failureResult = { success: false, error: (error as Error).message };
        results.push(failureResult);
      }
    }
    
    console.log(`✅ Successfully created ${successCount}/${documentTypes.length} documents with validation`);
    
    // Throw error if any documents failed to create
    if (successCount < documentTypes.length) {
      const failedCount = documentTypes.length - successCount;
      throw new Error(`Failed to create ${failedCount} documents during project creation`);
    }
  }

  /**
   * Apply DocumentType validation rules to form data
   */
  private async applyDocumentTypeValidationRules(
    formData: any, 
    docType: Schema['DocumentType']['type'], 
    validationRules: string
  ): Promise<any> {
    try {
      console.log(`🔧 Processing validation rules for ${docType.name}:`, validationRules);
      
      // Load the document type definition into the dynamic form service
      if (docType.definition) {
        this.dynamicFormService.generateDynamicFormSchema(docType.definition);
        
        // Load the validation rules
        this.dynamicFormService.loadWorkflowRulesFromText(validationRules);
        
        // Get the form group and populate it with current data
        const formGroup = this.dynamicFormService.dynamicFormGroup();
        if (formGroup) {
          // Populate form with current data
          Object.keys(formData).forEach(key => {
            const control = formGroup.get(key);
            if (control) {
              control.setValue(formData[key], { emitEvent: false });
            }
          });
          
          // Apply the validation rules
          const rules = this.dynamicFormService.workflowRules();
          const updatedFormData = { ...formData };
          
          for (const rule of rules) {
            try {
              console.log(`🔧 Applying rule: ${rule.validation} -> ${rule.action}`);
              
              // Basic rule application - set field values
              if (rule.action && rule.action.includes('=')) {
                const [field, value] = rule.action.split('=').map(s => s.trim());
                if (field && value) {
                  const cleanValue = value.replace(/"/g, '');
                  updatedFormData[field] = cleanValue;
                  console.log(`✅ Applied rule: Set ${field} = ${cleanValue}`);
                }
              }
            } catch (ruleError) {
              console.warn(`⚠️ Error applying rule: ${rule.validation} -> ${rule.action}`, ruleError);
            }
          }
          
          return updatedFormData;
        }
      }
      
      return formData;
    } catch (error) {
      console.error(`❌ Error applying validation rules for ${docType.name}:`, error);
      return formData; // Return original data if validation fails
    }
  }

  /**
   * Calculate document status based on form data using workflow service logic
   */
  private calculateDocumentStatus(formData: any): string {
    console.log(`🔍 Calculating status from formData:`, formData);
    
    // Look for common status field names in priority order
    let status = formData.status || formData.documentStatus || formData.requestStatus || 
                 formData.applicationStatus || formData.documentRequestStatus || 
                 formData.permitStatus || formData.approvalStatus || 
                 formData.submissionStatus || formData.reviewStatus || 
                 formData.processingStatus;

    // Handle boolean confirmation fields
    if (!status && formData.confirmed === true) {
      status = 'confirmed';
      console.log(`📋 Found confirmed=true, setting status to: ${status}`);
    }

    // Handle notrequired field
    if (!status && formData.notrequired === true) {
      status = 'notrequired';
      console.log(`📋 Found notrequired=true, setting status to: ${status}`);
    }

    // Handle documents with form data but no explicit status
    if (!status && Object.keys(formData).length > 0) {
      if (formData.files && formData.files !== '' && formData.files !== null) {
        status = 'completed';
        console.log(`📋 Found files, setting status to: ${status}`);
      } else {
        status = 'queued';
        console.log(`📋 Has form data but no explicit status, setting to: ${status}`);
      }
    }

    const finalStatus = status || 'queued';
    console.log(`📋 Final calculated status: "${finalStatus}"`);
    return finalStatus;
  }

  /**
   * Execute workflow rules for a project until no more changes occur
   */
  private async executeWorkflowRules(projectId: string) {
    console.log('🔄 Running workflow rules for project:', projectId);
    try {
      const workflowResult = await this.workflowService.executeWorkflowRulesForProject(
        projectId,
        undefined // No specific document ID - process all documents in the project
      );
      
      if (workflowResult.success) {
        console.log(`✅ Workflow execution completed: ${workflowResult.cascadeIterations} iterations, ${workflowResult.totalDocumentChanges} total changes`);
        console.log('📋 Applied actions:', workflowResult.appliedActions);
      } else {
        console.error('❌ Workflow execution failed:', workflowResult.error);
      }
    } catch (workflowError) {
      console.error('❌ Error running workflow rules:', workflowError);
      // Don't fail the operation if workflow execution fails
    }
  }
}