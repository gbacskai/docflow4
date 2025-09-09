import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Get environment name for table names
const envName = process.env.AWS_BRANCH || 'dev';

// Table names based on the naming convention
const DOCUMENT_TYPES_TABLE = `docflow4-DocumentType-${envName}`;
const WORKFLOWS_TABLE = `docflow4-Workflow-${envName}`;

// Sample document types
const SAMPLE_DOCUMENT_TYPES = [
  {
    id: 'dt-building-permit',
    name: 'Building Permit Application',
    identifier: 'BuildingPermit',
    description: 'Application for building permits including architectural plans, engineering reports, and zoning compliance documentation',
    category: 'Construction',
    fields: ['property_address', 'project_description', 'architect_details', 'contractor_license', 'estimated_cost'],
    isActive: true,
    usageCount: 0,
    templateCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'dt-environmental-assessment',
    name: 'Environmental Impact Assessment',
    identifier: 'environmental_assessment',
    description: 'Comprehensive environmental impact evaluation for development projects',
    category: 'Environment',
    fields: ['project_location', 'environmental_factors', 'mitigation_measures', 'compliance_certificates'],
    isActive: true,
    usageCount: 0,
    templateCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'dt-business-license',
    name: 'Business License Application',
    identifier: 'business_license',
    description: 'Application for new business license including registration documents and compliance certificates',
    category: 'Business',
    fields: ['business_name', 'business_type', 'owner_details', 'location_address', 'tax_id'],
    isActive: true,
    usageCount: 0,
    templateCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'dt-health-permit',
    name: 'Health Department Permit',
    identifier: 'health_permit',
    description: 'Health department permits for food service establishments and healthcare facilities',
    category: 'Health',
    fields: ['facility_type', 'health_inspection', 'staff_certifications', 'equipment_list'],
    isActive: true,
    usageCount: 0,
    templateCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Sample workflows
const SAMPLE_WORKFLOWS = [
  {
    id: 'wf-permit-approval',
    name: 'Standard Permit Approval Workflow',
    description: JSON.stringify({
      "steps": [
        {
          "stepName": "Application Submission",
          "stepIdentifier": "application_submission",
          "stepStatus": "pending",
          "stepDocuments": [
            {
              "documentIdentifier": "application_form",
              "status": "waiting"
            }
          ],
          "stepDependencies": []
        },
        {
          "stepName": "Initial Review",
          "stepIdentifier": "initial_review",
          "stepStatus": "waiting",
          "stepDocuments": [
            {
              "documentIdentifier": "review_checklist",
              "status": "waiting"
            }
          ],
          "stepDependencies": [
            {
              "stepIdentifier": "application_submission",
              "status": "completed"
            }
          ]
        },
        {
          "stepName": "Technical Assessment",
          "stepIdentifier": "technical_assessment",
          "stepStatus": "waiting",
          "stepDocuments": [
            {
              "documentIdentifier": "technical_report",
              "status": "waiting"
            }
          ],
          "stepDependencies": [
            {
              "stepIdentifier": "initial_review",
              "status": "completed"
            }
          ]
        },
        {
          "stepName": "Final Approval",
          "stepIdentifier": "final_approval",
          "stepStatus": "waiting",
          "stepDocuments": [
            {
              "documentIdentifier": "approval_certificate",
              "status": "waiting"
            }
          ],
          "stepDependencies": [
            {
              "stepIdentifier": "technical_assessment",
              "status": "completed"
            }
          ]
        }
      ]
    }),
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'wf-business-registration',
    name: 'Business Registration Workflow',
    description: JSON.stringify({
      "steps": [
        {
          "stepName": "Registration Application",
          "stepIdentifier": "registration_application",
          "stepStatus": "pending",
          "stepDocuments": [
            {
              "documentIdentifier": "business_application",
              "status": "waiting"
            }
          ],
          "stepDependencies": []
        },
        {
          "stepName": "Document Verification",
          "stepIdentifier": "document_verification",
          "stepStatus": "waiting",
          "stepDocuments": [
            {
              "documentIdentifier": "identity_documents",
              "status": "waiting"
            }
          ],
          "stepDependencies": [
            {
              "stepIdentifier": "registration_application",
              "status": "completed"
            }
          ]
        },
        {
          "stepName": "License Issuance",
          "stepIdentifier": "license_issuance",
          "stepStatus": "waiting",
          "stepDocuments": [
            {
              "documentIdentifier": "business_license",
              "status": "waiting"
            }
          ],
          "stepDependencies": [
            {
              "stepIdentifier": "document_verification",
              "status": "completed"
            }
          ]
        }
      ]
    }),
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Init Sample Data Lambda triggered');
  console.log('Environment:', envName);
  console.log('Document Types Table:', DOCUMENT_TYPES_TABLE);
  console.log('Workflows Table:', WORKFLOWS_TABLE);

  try {
    const results = {
      documentTypes: {
        created: 0,
        skipped: 0,
        errors: [] as string[]
      },
      workflows: {
        created: 0,
        skipped: 0,
        errors: [] as string[]
      }
    };

    // Initialize document types
    for (const docType of SAMPLE_DOCUMENT_TYPES) {
      try {
        // Check if document type already exists by identifier
        const existingQuery = {
          TableName: DOCUMENT_TYPES_TABLE,
          IndexName: 'identifierIndex', // Assuming there's a GSI on identifier
          KeyConditionExpression: 'identifier = :identifier',
          ExpressionAttributeValues: {
            ':identifier': docType.identifier
          }
        };

        let exists = false;
        try {
          const existingResult = await docClient.send(new QueryCommand(existingQuery));
          exists = !!(existingResult.Items && existingResult.Items.length > 0);
        } catch (queryError) {
          // If GSI doesn't exist, we'll try to insert and handle duplicate error
          console.log('GSI query failed, will attempt insert');
        }

        if (!exists) {
          await docClient.send(new PutCommand({
            TableName: DOCUMENT_TYPES_TABLE,
            Item: docType,
            ConditionExpression: 'attribute_not_exists(id)' // Prevent duplicates by ID
          }));
          results.documentTypes.created++;
          console.log(`Created document type: ${docType.name}`);
        } else {
          results.documentTypes.skipped++;
          console.log(`Skipped existing document type: ${docType.name}`);
        }
      } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
          results.documentTypes.skipped++;
          console.log(`Skipped existing document type: ${docType.name}`);
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.documentTypes.errors.push(`${docType.name}: ${errorMessage}`);
          console.error(`Error creating document type ${docType.name}:`, error);
        }
      }
    }

    // Initialize workflows
    for (const workflow of SAMPLE_WORKFLOWS) {
      try {
        await docClient.send(new PutCommand({
          TableName: WORKFLOWS_TABLE,
          Item: workflow,
          ConditionExpression: 'attribute_not_exists(id)' // Prevent duplicates by ID
        }));
        results.workflows.created++;
        console.log(`Created workflow: ${workflow.name}`);
      } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
          results.workflows.skipped++;
          console.log(`Skipped existing workflow: ${workflow.name}`);
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.workflows.errors.push(`${workflow.name}: ${errorMessage}`);
          console.error(`Error creating workflow ${workflow.name}:`, error);
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Sample data initialization completed',
        results
      })
    };

  } catch (error: any) {
    console.error('Error in init sample data:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to initialize sample data'
      })
    };
  }
};