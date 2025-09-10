# Reporting Component

This directory contains the analytics and reporting interface for system insights and data visualization.

## Purpose
Provides comprehensive reporting functionality with analytics dashboard and data export capabilities.

## Files
- `reporting.ts` - Reporting component with analytics and chart generation
- `reporting.html` - Template for reports, charts, and data visualization
- `reporting.less` - Styling for reports and chart displays
- `reporting.spec.ts` - Unit tests for reporting functionality

## Key Features

### Analytics Dashboard
- **System Metrics** - Overview of system usage and performance
- **User Analytics** - User engagement and activity tracking
- **Document Statistics** - Document type usage and processing metrics
- **Project Insights** - Project completion rates and workflow efficiency

### Data Visualization
- **Chart Generation** - Visual representation of system data
- **Export Functionality** - Data export in various formats (CSV, JSON, etc.)
- **Time-based Analysis** - Historical data trends and patterns

## Access Control
- **Authentication Required** - Protected by `authGuard` route guard
- **Role-based Access** - Different report access based on user permissions

## Integration
- **Data Services** - Integrates with all data models for comprehensive reporting
- **AWS Analytics** - Potential integration with AWS analytics services
- **Real-time Data** - Current system state and activity reporting

## When Creating or editing a new Project (in the reporting or project page)
- **Document Creation** - Create all documents based on
     - selected workflow and document types associated to the workflow 
     - via validation rules (validation or action) even multiple documents are in the validation or action
     - Only if not exists, do not update any existing document
- **Document Validation rules** - Run all Document validation rules and save each document
- **Workflow Rules** - Run all workflow rules until no document changed, make sure all document been saved
- **Fuctions are shared** - make sure the functions/procedures are shared between the reporting and project page