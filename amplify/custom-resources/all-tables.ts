/**
 * Custom DynamoDB tables with environment-specific naming
 * 
 * This creates custom DynamoDB tables with proper naming: docflow4-{TableName}-{Environment}
 * These tables run alongside the default Amplify GraphQL tables to ensure consistent naming
 * across all branches and environments.
 * 
 * Table naming pattern: docflow4-{TableName}-{Environment}
 * - Environment determined by: AWS_BRANCH > 'dev'
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export function createAllTables(scope: Construct, streamHandlerFunction?: any) {
  // Get the environment name using only out-of-the-box AWS_BRANCH variable
  const envName = process.env['AWS_BRANCH'] || 'dev';
  const appName = 'docflow4';

  // Console log the table naming pattern for verification
  console.log(`🏷️  Creating custom DynamoDB tables with naming pattern: ${appName}-{TableName}-${envName}`);
  console.log(`📊 Environment variables: AWS_BRANCH=${process.env['AWS_BRANCH']}`);
  console.log(`🎯 Resolved environment name: ${envName}`);

  // Helper function to create table with proper naming
  const createTableWithNaming = (logicalId: string, tableName: string, config: any) => {
    const finalTableName = `${appName}-${tableName}-${envName}`;
    console.log(`📋 Creating table: ${finalTableName}`);
    
    const table = new Table(scope, logicalId, {
      ...config,
      tableName: finalTableName,
    });

    // Override the table name at the CFN level to ensure it's respected
    const cfnTable = table.node.defaultChild as any;
    if (cfnTable && cfnTable.addPropertyOverride) {
      cfnTable.addPropertyOverride('TableName', finalTableName);
      console.log(`✅ Table configured: ${finalTableName}`);
    } else {
      console.log(`⚠️  CFN override not available for: ${finalTableName}`);
    }

    return table;
  };

  // Project Table
  const projectTable = createTableWithNaming('ProjectTable', 'Project', {
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
    partitionKey: {
      name: 'id',
      type: AttributeType.STRING,
    }
  });

  // Document Table
  const documentTable = createTableWithNaming('DocumentTable', 'Document', {
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
    partitionKey: {
      name: 'id',
      type: AttributeType.STRING,
    }
  });

  // Add GSI for querying documents by projectId
  documentTable.addGlobalSecondaryIndex({
    indexName: 'ProjectIndex',
    partitionKey: {
      name: 'projectId',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'createdAt',
      type: AttributeType.STRING,
    }
  });

  // User Table
  const userTable = createTableWithNaming('UserTable', 'User', {
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
    partitionKey: {
      name: 'id',
      type: AttributeType.STRING,
    }
  });

  // Add GSI for querying users by email
  userTable.addGlobalSecondaryIndex({
    indexName: 'EmailIndex',
    partitionKey: {
      name: 'email',
      type: AttributeType.STRING,
    }
  });

  // Add GSI for querying users by cognitoUserId
  userTable.addGlobalSecondaryIndex({
    indexName: 'CognitoUserIndex',
    partitionKey: {
      name: 'cognitoUserId',
      type: AttributeType.STRING,
    }
  });

  // DocumentType Table
  const documentTypeTable = createTableWithNaming('DocumentTypeTable', 'DocumentType', {
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
    partitionKey: {
      name: 'id',
      type: AttributeType.STRING,
    }
  });

  // Workflow Table
  const workflowTable = createTableWithNaming('WorkflowTable', 'Workflow', {
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
    partitionKey: {
      name: 'id',
      type: AttributeType.STRING,
    }
  });
  
  // ChatRoom Table
  const chatRoomTable = createTableWithNaming('ChatRoomTable', 'ChatRoom', {
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
    stream: StreamViewType.NEW_AND_OLD_IMAGES,
    partitionKey: {
      name: 'id',
      type: AttributeType.STRING,
    }
  });

  // Add GSI for querying by projectId
  chatRoomTable.addGlobalSecondaryIndex({
    indexName: 'ProjectIndex',
    partitionKey: {
      name: 'projectId',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'createdAt',
      type: AttributeType.STRING,
    }
  });

  // Add GSI for querying by documentId
  chatRoomTable.addGlobalSecondaryIndex({
    indexName: 'DocumentIndex',
    partitionKey: {
      name: 'documentId',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'createdAt',
      type: AttributeType.STRING,
    }
  });

  // ChatMessage Table
  const chatMessageTable = createTableWithNaming('ChatMessageTable', 'ChatMessage', {
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
    stream: StreamViewType.NEW_AND_OLD_IMAGES,
    partitionKey: {
      name: 'chatRoomId',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'timestamp',
      type: AttributeType.STRING,
    }
  });

  // Add GSI for querying messages by sender
  chatMessageTable.addGlobalSecondaryIndex({
    indexName: 'SenderIndex',
    partitionKey: {
      name: 'senderId',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'timestamp',
      type: AttributeType.STRING,
    }
  });

  // Add GSI for thread messages
  chatMessageTable.addGlobalSecondaryIndex({
    indexName: 'ThreadIndex',
    partitionKey: {
      name: 'threadId',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'timestamp',
      type: AttributeType.STRING,
    }
  });

  // Add DynamoDB Stream event sources if handler function is provided
  if (streamHandlerFunction) {
    // Access the underlying Lambda function resource
    const lambdaFunction = streamHandlerFunction.resources.lambda;
    
    lambdaFunction.addEventSource(new DynamoEventSource(chatMessageTable, {
      startingPosition: StartingPosition.LATEST,
      batchSize: 10,
      retryAttempts: 3
    }));

    lambdaFunction.addEventSource(new DynamoEventSource(chatRoomTable, {
      startingPosition: StartingPosition.LATEST,
      batchSize: 5,
      retryAttempts: 3
    }));

    // Grant permissions to read from the tables
    chatMessageTable.grantStreamRead(lambdaFunction);
    chatRoomTable.grantStreamRead(lambdaFunction);
  }

  return {
    projectTable,
    documentTable,
    userTable,
    documentTypeTable,
    workflowTable,
    chatRoomTable,
    chatMessageTable
  };
}