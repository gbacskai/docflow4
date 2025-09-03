# Workflows Component

This directory contains the workflow management component with visual flowchart builder and rule-based automation system.

## Purpose
Advanced workflow design interface with visual flowchart generation, rule validation, and actor permission management for document processing automation.

## Files
- `workflows.ts` - Workflow management with visual builder and rule engine
- `workflows.html` - Template with flowchart display and rule configuration forms
- `workflows.less` - Styling for visual flowchart and workflow interface
- `workflows.spec.ts` - Unit tests with mocked rule parsing and flowchart generation

## Key Features

### Visual Workflow Builder
- **`generateFlowchart()`** - Parses rules and creates node/connection graph with topological sorting
- **Drag-and-drop Interface** - DocumentType sidebar for easy rule building
- **Real-time Updates** - Flowchart updates automatically when rules change
- **Node Positioning** - Intelligent layout of workflow nodes and connections

### Rule-based Engine
- **JSON Rule Storage** - Complex validation rules stored in `rules` array field
- **Validation Logic** - Rule conditions like `document.BuildingPermit.status in ("completed","notrequired")`
- **Action Definitions** - Rule actions like `process.EnvironmentalAssessment`
- **Rule Dependencies** - Complex interdependencies between workflow steps

### Actor Permission System
- **Permission Matrix** - Actor access control for document types
- **Role Management** - Assign actors to specific workflow steps
- **Access Control** - Define who can access which document types in workflows

## Technical Implementation

### Rule Format Example
```json
{
  "id": "rule_1", 
  "validation": "document.BuildingPermit.status in (\"completed\",\"notrequired\")",
  "action": "process.EnvironmentalAssessment"
}
```

### Testing Patterns
- **Mock Required** - Tests must mock `extractDocumentTypesFromRules()` and `generateFlowchart()` methods
- **Complex Logic** - Rule parsing involves sophisticated validation and flowchart generation
- **fakeAsync Testing** - Requires proper async testing for form and flowchart operations

## AI Integration
- **Workflow Validation** - Uses Claude 3 Sonnet for intelligent workflow generation via `validateWorkflow` GraphQL operation

## Related Components
- Projects: `src/app/projects/` assigns workflows to projects
- Document Types: Used in rule validation and action definitions
- Visual Builder: Complex flowchart generation with node positioning algorithms