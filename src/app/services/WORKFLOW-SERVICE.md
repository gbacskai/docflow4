# Workflow Service

This service provides workflow rule execution functionality for automating document processing based on project workflows.

## Purpose
Executes workflow rules automatically after document saves to:
- Update document statuses based on rule conditions
- Trigger subsequent document processing
- Maintain workflow state consistency across project documents

## Key Features

### Workflow Rule Execution
- **Condition Evaluation**: Evaluates complex validation conditions against current document statuses
- **Action Processing**: Executes workflow actions like status updates and document processing
- **Multi-Rule Support**: Processes all rules in a workflow sequentially
- **Error Handling**: Comprehensive error handling with detailed logging

### Supported Rule Patterns

#### Validation Conditions
- `DocumentType.status = "completed"` - Exact status match
- `DocumentType.status in ("completed", "notrequired")` - Multiple value match
- `document.DocumentType.status = "completed"` - Prefixed document reference
- Multi-line conditions with AND logic

#### Actions
- `DocumentType.status = "queued"` - Set document status
- `process.DocumentType` - Mark document for processing
- Future: `create.DocumentType`, `notify.User` patterns

### Integration Points
- **Reporting Component**: Automatically executes after document saves
- **Document Status Extraction**: Parses form data to determine current document states
- **Versioned Data Service**: Updates document records with new statuses

## Usage Example

```typescript
const result = await workflowService.executeWorkflowRulesForProject(
  projectId, 
  triggeredByDocumentId
);

if (result.success) {
  console.log(`${result.executedRules} rules executed`);
  console.log(`${result.appliedActions.length} actions applied`);
  console.log(`${result.updatedDocuments.length} documents updated`);
}
```

## Rule Examples

### Simple Status Check
```json
{
  "validation": "BuildingPermit.status = \"completed\"",
  "action": "process.EnvironmentalAssessment"
}
```

### Multiple Prerequisites
```json
{
  "validation": "TitleSearch.status in (\"completed\", \"notrequired\")",
  "action": "PropertyReport.status = \"queued\""
}
```

## Implementation Notes
- Rules are executed in the order they appear in the workflow
- All validation conditions must be true (AND logic) for actions to execute
- Document statuses are extracted from form data using priority field names
- Actions are applied immediately and persisted to the database
- Comprehensive logging provides visibility into rule execution process

## Future Enhancements
- Support for OR conditions in validation
- User notification actions
- Document creation actions  
- Time-based rule triggers
- Rule execution history and audit logs