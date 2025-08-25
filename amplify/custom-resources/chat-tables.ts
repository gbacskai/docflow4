import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export function createChatTables(scope: Construct, streamHandlerFunction?: any) {
  // ChatRoom Table
  const chatRoomTable = new Table(scope, 'ChatRoomTable', {
    tableName: 'ChatRoom',
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY, // For development
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
  const chatMessageTable = new Table(scope, 'ChatMessageTable', {
    tableName: 'ChatMessage',
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY, // For development
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
    chatRoomTable,
    chatMessageTable
  };
}