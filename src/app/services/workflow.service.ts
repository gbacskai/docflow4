import { Injectable, inject } from '@angular/core';
import type { Schema } from '../../../amplify/data/resource';
import { VersionedDataService } from './versioned-data.service';

export interface WorkflowExecutionResult {
  success: boolean;
  executedRules: number;
  appliedActions: string[];
  updatedDocuments: Array<{ documentId: string; changes: any }>;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private versionedDataService = inject(VersionedDataService);

  /**
   * Execute workflow rules for a project after a document is updated
   */
  async executeWorkflowRulesForProject(
    projectId: string, 
    triggeredByDocumentId?: string
  ): Promise<WorkflowExecutionResult> {
    console.log(`🔄 Executing workflow rules for project: ${projectId}`);
    
    try {
      // Get project and its workflow
      const projectResult = await this.versionedDataService.getLatestVersion('Project', projectId);
      if (!projectResult.success || !projectResult.data) {
        return { success: false, executedRules: 0, appliedActions: [], updatedDocuments: [], error: 'Project not found' };
      }

      const project = projectResult.data;
      if (!project.workflowId) {
        console.log('⚠️ Project has no workflow assigned');
        return { success: true, executedRules: 0, appliedActions: [], updatedDocuments: [] };
      }

      // Get workflow
      const workflowResult = await this.versionedDataService.getLatestVersion('Workflow', project.workflowId);
      if (!workflowResult.success || !workflowResult.data) {
        return { success: false, executedRules: 0, appliedActions: [], updatedDocuments: [], error: 'Workflow not found' };
      }

      const workflow = workflowResult.data;
      if (!workflow.rules || workflow.rules.length === 0) {
        console.log('⚠️ Workflow has no rules');
        return { success: true, executedRules: 0, appliedActions: [], updatedDocuments: [] };
      }

      // Get all documents for the project
      const documentsResult = await this.versionedDataService.getAllLatestVersions('Document');
      if (!documentsResult.success || !documentsResult.data) {
        return { success: false, executedRules: 0, appliedActions: [], updatedDocuments: [], error: 'Could not load documents' };
      }

      const projectDocuments = documentsResult.data.filter(doc => doc.projectId === projectId);
      console.log(`📄 Found ${projectDocuments.length} documents for project`);

      // Get document types for reference
      const documentTypesResult = await this.versionedDataService.getAllLatestVersions('DocumentType');
      const documentTypes = documentTypesResult.success ? documentTypesResult.data || [] : [];

      // Build document status map
      const documentStatuses = this.buildDocumentStatusMap(projectDocuments, documentTypes);
      console.log('📊 Document statuses:', Object.fromEntries(documentStatuses));

      // Execute workflow rules
      const result = await this.executeWorkflowRules(
        workflow, 
        projectDocuments, 
        documentTypes, 
        documentStatuses,
        triggeredByDocumentId
      );

      console.log(`✅ Workflow execution completed: ${result.executedRules} rules executed, ${result.appliedActions.length} actions applied`);
      return result;

    } catch (error: any) {
      console.error('❌ Error executing workflow rules:', error);
      return { 
        success: false, 
        executedRules: 0, 
        appliedActions: [], 
        updatedDocuments: [], 
        error: error.message 
      };
    }
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
      updatedDocuments
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

      // Update status
      const updatedFormData = { ...formData, status: newStatus };

      // Save updated document
      const result = await this.versionedDataService.updateVersionedRecord('Document', document.id, {
        formData: JSON.stringify(updatedFormData)
      });

      if (result.success) {
        console.log(`📄 Updated document ${docTypeIdentifier} status to: ${newStatus}`);
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