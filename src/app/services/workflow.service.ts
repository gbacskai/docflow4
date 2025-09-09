import { Injectable, inject } from '@angular/core';
import type { Schema } from '../../../amplify/data/resource';
import { VersionedDataService } from './versioned-data.service';

export interface WorkflowExecutionResult {
  success: boolean;
  executedRules: number;
  appliedActions: string[];
  updatedDocuments: Array<{ documentId: string; changes: any }>;
  cascadeIterations: number;
  totalDocumentChanges: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private versionedDataService = inject(VersionedDataService);

  /**
   * Execute workflow rules for a project after a document is updated with cascading validation
   */
  async executeWorkflowRulesForProject(
    projectId: string, 
    triggeredByDocumentId?: string
  ): Promise<WorkflowExecutionResult> {
    console.log(`🔄 Executing cascading workflow rules for project: ${projectId}`);
    
    try {
      // Get project and its workflow
      const projectResult = await this.versionedDataService.getLatestVersion('Project', projectId);
      if (!projectResult.success || !projectResult.data) {
        return { success: false, executedRules: 0, appliedActions: [], updatedDocuments: [], cascadeIterations: 0, totalDocumentChanges: 0, error: 'Project not found' };
      }

      const project = projectResult.data;
      if (!project.workflowId) {
        console.log('⚠️ Project has no workflow assigned');
        return { success: true, executedRules: 0, appliedActions: [], updatedDocuments: [], cascadeIterations: 0, totalDocumentChanges: 0 };
      }

      // Get workflow
      const workflowResult = await this.versionedDataService.getLatestVersion('Workflow', project.workflowId);
      if (!workflowResult.success || !workflowResult.data) {
        return { success: false, executedRules: 0, appliedActions: [], updatedDocuments: [], cascadeIterations: 0, totalDocumentChanges: 0, error: 'Workflow not found' };
      }

      const workflow = workflowResult.data;
      if (!workflow.rules || workflow.rules.length === 0) {
        console.log('⚠️ Workflow has no rules');
        return { success: true, executedRules: 0, appliedActions: [], updatedDocuments: [], cascadeIterations: 0, totalDocumentChanges: 0 };
      }

      // Get document types for reference
      const documentTypesResult = await this.versionedDataService.getAllLatestVersions('DocumentType');
      const documentTypes = documentTypesResult.success ? documentTypesResult.data || [] : [];

      // Execute cascading workflow rules
      const result = await this.executeCascadingWorkflowRules(
        workflow, 
        projectId, 
        documentTypes, 
        triggeredByDocumentId
      );

      console.log(`✅ Cascading workflow execution completed: ${result.cascadeIterations} iterations, ${result.totalDocumentChanges} total changes, ${result.executedRules} rules executed`);
      return result;

    } catch (error: any) {
      console.error('❌ Error executing cascading workflow rules:', error);
      return { 
        success: false, 
        executedRules: 0, 
        appliedActions: [], 
        updatedDocuments: [], 
        cascadeIterations: 0, 
        totalDocumentChanges: 0, 
        error: error.message 
      };
    }
  }

  /**
   * Execute cascading workflow rules until no more documents change
   */
  private async executeCascadingWorkflowRules(
    workflow: Schema['Workflow']['type'],
    projectId: string,
    documentTypes: Array<Schema['DocumentType']['type']>,
    triggeredByDocumentId?: string
  ): Promise<WorkflowExecutionResult> {
    let cascadeIterations = 0;
    let totalExecutedRules = 0;
    let totalAppliedActions: string[] = [];
    let totalUpdatedDocuments: Array<{ documentId: string; changes: any }> = [];
    const maxIterations = 10; // Prevent infinite loops

    console.log(`🔄 Starting cascading workflow execution (max ${maxIterations} iterations)`);

    while (cascadeIterations < maxIterations) {
      cascadeIterations++;
      console.log(`🔄 Cascade iteration ${cascadeIterations}`);

      // Get fresh documents for this iteration
      const documentsResult = await this.versionedDataService.getAllLatestVersions('Document');
      if (!documentsResult.success || !documentsResult.data) {
        return { 
          success: false, 
          executedRules: totalExecutedRules, 
          appliedActions: totalAppliedActions, 
          updatedDocuments: totalUpdatedDocuments, 
          cascadeIterations, 
          totalDocumentChanges: totalUpdatedDocuments.length, 
          error: 'Could not load documents' 
        };
      }

      const projectDocuments = documentsResult.data.filter(doc => doc.projectId === projectId);
      
      // Build fresh document status map
      const documentStatuses = this.buildDocumentStatusMap(projectDocuments, documentTypes);
      console.log(`📊 Iteration ${cascadeIterations} document statuses:`, Object.fromEntries(documentStatuses));

      // Execute workflow rules for this iteration
      const iterationResult = await this.executeWorkflowRules(
        workflow, 
        projectDocuments, 
        documentTypes, 
        documentStatuses,
        triggeredByDocumentId
      );

      // Accumulate results
      totalExecutedRules += iterationResult.executedRules;
      totalAppliedActions.push(...iterationResult.appliedActions);
      totalUpdatedDocuments.push(...iterationResult.updatedDocuments);

      console.log(`📊 Iteration ${cascadeIterations} results: ${iterationResult.executedRules} rules, ${iterationResult.appliedActions.length} actions, ${iterationResult.updatedDocuments.length} document changes`);

      // If no documents were updated in this iteration, we're done
      if (iterationResult.updatedDocuments.length === 0) {
        console.log(`✅ No more document changes detected. Cascading complete after ${cascadeIterations} iterations.`);
        break;
      }

      // If this is not the last possible iteration, continue
      if (cascadeIterations >= maxIterations) {
        console.log(`⚠️ Maximum cascade iterations (${maxIterations}) reached. Stopping to prevent infinite loop.`);
        break;
      }
    }

    return {
      success: true,
      executedRules: totalExecutedRules,
      appliedActions: totalAppliedActions,
      updatedDocuments: totalUpdatedDocuments,
      cascadeIterations,
      totalDocumentChanges: totalUpdatedDocuments.length
    };
  }

  /**
   * Build a map of document statuses by document type identifier
   */
  private buildDocumentStatusMap(
    documents: Array<Schema['Document']['type']>, 
    documentTypes: Array<Schema['DocumentType']['type']>
  ): Map<string, string> {
    const statusMap = new Map<string, string>();

    documents.forEach(doc => {
      const docType = documentTypes.find(dt => dt.id === doc.documentType);
      if (!docType || !docType.identifier) {
        console.log(`⚠️ Skipping document ${doc.id} - no matching document type or identifier`);
        return;
      }

      console.log(`🔍 Processing document for ${docType.name} (identifier: ${docType.identifier})`);

      // Extract status from document form data
      let status = 'queued'; // default status
      if (doc.formData) {
        try {
          const formData = JSON.parse(doc.formData);
          status = this.extractDocumentStatus(formData);
        } catch (error) {
          console.error('Error parsing document formData:', error);
        }
      }

      console.log(`📋 Setting ${docType.identifier} status to: "${status}"`);
      statusMap.set(docType.identifier, status);
    });

    return statusMap;
  }

  /**
   * Extract status from document form data
   */
  private extractDocumentStatus(formData: any): string {
    console.log(`🔍 Extracting status from formData:`, formData);
    
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
    console.log(`📋 Final extracted status: "${finalStatus}"`);
    return finalStatus;
  }

  /**
   * Execute workflow rules and apply actions
   */
  private async executeWorkflowRules(
    workflow: Schema['Workflow']['type'],
    documents: Array<Schema['Document']['type']>,
    documentTypes: Array<Schema['DocumentType']['type']>,
    documentStatuses: Map<string, string>,
    triggeredByDocumentId?: string
  ): Promise<WorkflowExecutionResult> {
    let executedRules = 0;
    const appliedActions: string[] = [];
    const updatedDocuments: Array<{ documentId: string; changes: any }> = [];

    for (const ruleString of workflow.rules as any[]) {
      try {
        const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
        const validation = rule.validation || '';
        const action = rule.action || '';

        if (!validation || !action) continue;

        console.log(`🔍 Evaluating rule: ${validation} -> ${action}`);

        // Evaluate the validation condition
        const conditionMet = this.evaluateWorkflowCondition(validation, documentStatuses);
        console.log(`📝 Rule condition result: ${conditionMet}`);

        if (conditionMet) {
          executedRules++;
          
          // Execute the action
          const actionResult = await this.executeWorkflowAction(
            action, 
            documents, 
            documentTypes, 
            triggeredByDocumentId
          );

          if (actionResult.success) {
            appliedActions.push(`${validation} -> ${action}`);
            if (actionResult.updatedDocuments) {
              updatedDocuments.push(...actionResult.updatedDocuments);
            }
            console.log(`✅ Action executed: ${action}`);
          } else {
            console.log(`⚠️ Action failed: ${action} - ${actionResult.error}`);
          }
        }
      } catch (error) {
        console.error('Error processing workflow rule:', ruleString, error);
      }
    }

    return {
      success: true,
      executedRules,
      appliedActions,
      updatedDocuments,
      cascadeIterations: 0,
      totalDocumentChanges: updatedDocuments.length
    };
  }

  /**
   * Evaluate workflow condition (adapted from workflows component)
   */
  private evaluateWorkflowCondition(condition: string, documentStatuses: Map<string, string>): boolean {
    try {
      // Handle multi-line conditions with 'and' operators
      const lines = condition.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      for (const line of lines) {
        if (!this.evaluateSingleCondition(line, documentStatuses)) {
          return false; // All conditions must be true (AND logic)
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error evaluating workflow condition:', condition, error);
      return false;
    }
  }

  /**
   * Evaluate a single workflow condition
   */
  private evaluateSingleCondition(condition: string, documentStatuses: Map<string, string>): boolean {
    console.log(`🔍 Evaluating single condition: "${condition}"`);
    console.log(`🔍 Available document statuses:`, Object.fromEntries(documentStatuses));
    
    // Handle different condition patterns
    // Pattern: DocumentType.status = "value"
    // Pattern: DocumentType.status in ("value1", "value2")
    
    // Simple equality: DocumentType.status = "completed"
    let match = condition.match(/(\w+)\.status\s*=\s*"([^"]+)"/);
    if (match) {
      const [, docType, expectedStatus] = match;
      const actualStatus = documentStatuses.get(docType);
      console.log(`📋 Simple equality check: ${docType}.status = "${expectedStatus}", actual: "${actualStatus}"`);
      return actualStatus === expectedStatus;
    }

    // Simple equality with single quotes: DocumentType.status = 'completed'
    match = condition.match(/(\w+)\.status\s*=\s*'([^']+)'/);
    if (match) {
      const [, docType, expectedStatus] = match;
      const actualStatus = documentStatuses.get(docType);
      console.log(`📋 Simple equality check (single quotes): ${docType}.status = '${expectedStatus}', actual: "${actualStatus}"`);
      return actualStatus === expectedStatus;
    }

    // areRequiredFieldsFilled function call: areRequiredFieldsFilled(DocumentType) == true
    match = condition.match(/areRequiredFieldsFilled\(([^)]+)\)\s*([=!]+)\s*(true|false)/);
    if (match) {
      const [, docTypeIdentifier, operator, expectedValue] = match;
      console.log(`🔍 Evaluating areRequiredFieldsFilled(${docTypeIdentifier}) ${operator} ${expectedValue}`);
      
      // This is async, but we need to handle it synchronously in current architecture
      // For now, return false and log that this needs async support
      console.warn(`⚠️ areRequiredFieldsFilled() requires async support - not yet implemented in condition evaluation`);
      return false;
    }

    // In operator: DocumentType.status in ("completed", "notrequired")
    match = condition.match(/(\w+)\.status\s+in\s*\(([^)]+)\)/);
    if (match) {
      const [, docType, valueList] = match;
      const actualStatus = documentStatuses.get(docType);
      const allowedValues = valueList.split(',').map(v => v.trim().replace(/['"]/g, ''));
      console.log(`📋 In operator check: ${docType}.status in [${allowedValues.join(', ')}], actual: "${actualStatus}"`);
      return allowedValues.includes(actualStatus || '');
    }

    // Document.DocumentType.status patterns
    match = condition.match(/document\.(\w+)\.status\s*=\s*"([^"]+)"/);
    if (match) {
      const [, docType, expectedStatus] = match;
      const actualStatus = documentStatuses.get(docType);
      console.log(`📋 Document prefix check: document.${docType}.status = "${expectedStatus}", actual: "${actualStatus}"`);
      return actualStatus === expectedStatus;
    }

    console.log(`⚠️ Unrecognized condition pattern: ${condition}`);
    return false;
  }

  /**
   * Execute workflow action
   */
  private async executeWorkflowAction(
    action: string,
    documents: Array<Schema['Document']['type']>,
    documentTypes: Array<Schema['DocumentType']['type']>,
    triggeredByDocumentId?: string
  ): Promise<{ success: boolean; updatedDocuments?: Array<{ documentId: string; changes: any }>; error?: string }> {
    try {
      // Parse action patterns
      // Pattern: process.DocumentType
      // Pattern: DocumentType.status = "value"  
      // Pattern: DocumentType.status = getStatus(AnotherDocumentType)
      // Pattern: status = getStatus(DocumentType)
      // Pattern: create.DocumentType
      
      const updatedDocuments: Array<{ documentId: string; changes: any }> = [];

      // Simple status update: DocumentType.status = "completed"
      let match = action.match(/(\w+)\.status\s*=\s*"([^"]+)"/);
      if (match) {
        const [, docTypeIdentifier, newStatus] = match;
        const result = await this.updateDocumentStatus(docTypeIdentifier, newStatus, documents, documentTypes);
        if (result.success && result.documentId) {
          updatedDocuments.push({ documentId: result.documentId, changes: { status: newStatus } });
        }
        return { success: result.success, updatedDocuments, error: result.error };
      }

      // Status assignment with getStatus() function: DocumentType.status = getStatus(AnotherDocumentType)
      match = action.match(/(\w+)\.status\s*=\s*getStatus\(([^)]+)\)/);
      if (match) {
        const [, targetDocTypeIdentifier, sourceDocTypeIdentifier] = match;
        
        console.log(`🔄 Executing getStatus action: ${targetDocTypeIdentifier}.status = getStatus(${sourceDocTypeIdentifier})`);
        
        // Get the fresh status from the source document
        const statusResult = await this.getStatus(sourceDocTypeIdentifier, documents, documentTypes);
        
        if (!statusResult.success) {
          return { success: false, error: statusResult.error };
        }
        
        const freshStatus = statusResult.status || '';
        console.log(`📊 Retrieved fresh status: "${freshStatus}" from ${sourceDocTypeIdentifier}`);
        
        // Update the target document with the retrieved status
        const updateResult = await this.updateDocumentStatus(targetDocTypeIdentifier, freshStatus, documents, documentTypes);
        
        if (updateResult.success && updateResult.documentId) {
          updatedDocuments.push({ 
            documentId: updateResult.documentId, 
            changes: { 
              status: freshStatus,
              statusSource: `getStatus(${sourceDocTypeIdentifier})` 
            } 
          });
          
          console.log(`✅ Updated ${targetDocTypeIdentifier} status to "${freshStatus}" using getStatus(${sourceDocTypeIdentifier})`);
        }
        
        return { success: updateResult.success, updatedDocuments, error: updateResult.error };
      }

      // Simple status assignment with getStatus(): status = getStatus(DocumentType)  
      // This applies to the document that triggered the workflow rule
      match = action.match(/status\s*=\s*getStatus\(([^)]+)\)/);
      if (match) {
        const [, sourceDocTypeIdentifier] = match;
        
        console.log(`🔄 Executing simple getStatus action: status = getStatus(${sourceDocTypeIdentifier})`);
        
        // Get the fresh status from the source document
        const statusResult = await this.getStatus(sourceDocTypeIdentifier, documents, documentTypes);
        
        if (!statusResult.success) {
          return { success: false, error: statusResult.error };
        }
        
        const freshStatus = statusResult.status || '';
        console.log(`📊 Retrieved fresh status: "${freshStatus}" from ${sourceDocTypeIdentifier}`);
        
        // Since no target document is specified, we need to use the triggered document or return the status for further processing
        // For now, we'll just return the result without updating any document
        // This allows the rule system to use this value in other ways
        console.log(`✅ Retrieved status "${freshStatus}" using getStatus(${sourceDocTypeIdentifier})`);
        
        return { 
          success: true, 
          updatedDocuments: [], // No documents updated, just status retrieved
          error: undefined
        };
      }

      // Process action: process.DocumentType
      match = action.match(/process\.(\w+)/);
      if (match) {
        const [, docTypeIdentifier] = match;
        const result = await this.updateDocumentStatus(docTypeIdentifier, 'queued', documents, documentTypes);
        if (result.success && result.documentId) {
          updatedDocuments.push({ documentId: result.documentId, changes: { status: 'queued' } });
        }
        return { success: result.success, updatedDocuments, error: result.error };
      }

      console.log(`⚠️ Unrecognized action pattern: ${action}`);
      return { success: false, error: `Unrecognized action pattern: ${action}` };

    } catch (error: any) {
      console.error('Error executing workflow action:', action, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if all required fields are filled for a document type
   */
  async areRequiredFieldsFilled(docTypeIdentifier: string, documents: Array<Schema['Document']['type']>, documentTypes: Array<Schema['DocumentType']['type']>): Promise<{ success: boolean; filled?: boolean; missing?: string[]; error?: string }> {
    try {
      console.log(`🔍 Checking required fields for document type: ${docTypeIdentifier}`);
      
      // Find the document type
      const docType = documentTypes.find(dt => dt.identifier === docTypeIdentifier);
      if (!docType) {
        return { success: false, error: `Document type ${docTypeIdentifier} not found` };
      }

      // Find the latest document for this type
      const relevantDocuments = documents.filter(doc => doc.documentType === docTypeIdentifier);
      if (relevantDocuments.length === 0) {
        return { success: true, filled: false, missing: ['No document exists'] };
      }

      const latestDocument = relevantDocuments.reduce((latest, current) => {
        const currentDate = new Date(current.updatedAt || Date.now());
        const latestDate = new Date(latest.updatedAt || Date.now());
        return currentDate > latestDate ? current : latest;
      });

      // Parse document type definition to get required fields
      let definition;
      try {
        definition = typeof docType.definition === 'string' ? JSON.parse(docType.definition) : docType.definition;
      } catch (error) {
        return { success: false, error: `Failed to parse document type definition: ${error}` };
      }

      // Parse document form data
      let formData = {};
      if (latestDocument.formData) {
        try {
          formData = JSON.parse(latestDocument.formData);
        } catch (error) {
          console.warn('Failed to parse document formData:', error);
        }
      }

      // Check all required fields
      const missingFields: string[] = [];
      const checkRequiredFields = (fields: any[], data: any, prefix = '') => {
        for (const field of fields) {
          if (field.required) {
            const fieldPath = prefix ? `${prefix}.${field.key}` : field.key;
            const value = data[field.key];
            
            if (field.type === 'array') {
              // For array fields, check if at least one item exists and all required sub-fields are filled
              if (!Array.isArray(value) || value.length === 0) {
                missingFields.push(`${fieldPath} (array must have at least one item)`);
              } else if (field.itemSchema || field[`${field.key}Schema`] || field.schema) {
                // Check sub-fields in array items
                const itemSchema = field.itemSchema || field[`${field.key}Schema`] || field.schema;
                const subFields = Object.entries(itemSchema).map(([key, def]) => ({
                  key,
                  required: (def as any)?.required || false,
                  type: (def as any)?.type || 'text'
                }));
                
                for (let i = 0; i < value.length; i++) {
                  const item = value[i];
                  for (const subField of subFields) {
                    if (subField.required) {
                      const subValue = item[subField.key];
                      if (!subValue || (typeof subValue === 'string' && subValue.trim() === '')) {
                        missingFields.push(`${fieldPath}[${i}].${subField.key}`);
                      }
                    }
                  }
                }
              }
            } else {
              // For regular fields, check if value exists and is not empty
              if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
                missingFields.push(fieldPath);
              }
            }
          }
        }
      };

      // Process fields from definition
      if (definition.fields && Array.isArray(definition.fields)) {
        checkRequiredFields(definition.fields, formData);
      }

      const allFilled = missingFields.length === 0;
      console.log(`📋 Required fields check for ${docTypeIdentifier}: ${allFilled ? 'PASSED' : 'FAILED'}`);
      if (missingFields.length > 0) {
        console.log(`❌ Missing required fields:`, missingFields);
      }

      return { 
        success: true, 
        filled: allFilled, 
        missing: missingFields.length > 0 ? missingFields : undefined 
      };
      
    } catch (error) {
      console.error('Error checking required fields:', error);
      return { success: false, error: `Error checking required fields: ${error}` };
    }
  }

  /**
   * Get the current status of a document by making a fresh API call
   * This ensures we always get the latest status from the database
   */
  private async getStatus(
    docTypeIdentifier: string,
    documents: Array<Schema['Document']['type']>,
    documentTypes: Array<Schema['DocumentType']['type']>
  ): Promise<{ success: boolean; status?: string; documentId?: string; error?: string }> {
    try {
      // Find document type
      const docType = documentTypes.find(dt => dt.identifier === docTypeIdentifier);
      if (!docType) {
        return { success: false, error: `Document type not found: ${docTypeIdentifier}` };
      }

      // Find document in current array (to get the ID)
      const document = documents.find(doc => doc.documentType === docType.id);
      if (!document) {
        return { success: false, error: `Document not found for type: ${docTypeIdentifier}` };
      }

      console.log(`🔍 getStatus() - Making fresh API call for document ID: ${document.id}`);

      // Make fresh API call to get the latest version of this specific document
      const result = await this.versionedDataService.getLatestVersion('Document', document.id);
      
      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'Failed to fetch latest document' };
      }

      const latestDocument = result.data;
      
      // Parse form data to get current status
      let currentStatus = '';
      if (latestDocument.formData) {
        try {
          const formData = JSON.parse(latestDocument.formData);
          currentStatus = this.extractDocumentStatus(formData);
        } catch (error) {
          console.warn('Error parsing form data for status extraction:', error);
          currentStatus = '';
        }
      }

      console.log(`📊 getStatus() - Retrieved fresh status for ${docTypeIdentifier}: "${currentStatus}"`);
      
      return { 
        success: true, 
        status: currentStatus,
        documentId: document.id 
      };

    } catch (error: any) {
      console.error('Error in getStatus():', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update document status in form data
   */
  private async updateDocumentStatus(
    docTypeIdentifier: string,
    newStatus: string,
    documents: Array<Schema['Document']['type']>,
    documentTypes: Array<Schema['DocumentType']['type']>
  ): Promise<{ success: boolean; documentId?: string; error?: string }> {
    // Find document type
    const docType = documentTypes.find(dt => dt.identifier === docTypeIdentifier);
    if (!docType) {
      return { success: false, error: `Document type not found: ${docTypeIdentifier}` };
    }

    // Find document
    const document = documents.find(doc => doc.documentType === docType.id);
    if (!document) {
      return { success: false, error: `Document not found for type: ${docTypeIdentifier}` };
    }

    try {
      // Parse existing form data
      let formData = {};
      if (document.formData) {
        formData = JSON.parse(document.formData);
      }

      // Check if status is actually changing to avoid unnecessary updates
      const currentStatus = this.extractDocumentStatus(formData);
      if (currentStatus === newStatus) {
        console.log(`📄 Document ${docTypeIdentifier} already has status: ${newStatus}, skipping update`);
        return { success: true, documentId: document.id };
      }

      // Update status
      const updatedFormData = { ...formData, status: newStatus };

      // Save updated document
      const result = await this.versionedDataService.updateVersionedRecord('Document', document.id, {
        formData: JSON.stringify(updatedFormData)
      });

      if (result.success) {
        console.log(`📄 Updated document ${docTypeIdentifier} status from "${currentStatus}" to: "${newStatus}"`);
        return { success: true, documentId: document.id };
      } else {
        return { success: false, error: result.error };
      }

    } catch (error: any) {
      console.error('Error updating document status:', error);
      return { success: false, error: error.message };
    }
  }
}