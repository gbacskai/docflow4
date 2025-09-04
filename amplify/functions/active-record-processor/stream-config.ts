import { Construct } from 'constructs';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { StreamViewType } from 'aws-cdk-lib/aws-dynamodb';

export function configureStreamTriggers(
  scope: Construct, 
  lambdaFunction: any, 
  tables: Record<string, any>
) {
  const tableNames = ['Project', 'Document', 'User', 'DocumentType', 'Workflow', 'ChatRoom', 'ChatMessage'];
  
  tableNames.forEach(tableName => {
    const table = tables[tableName];
    if (table) {
      // Enable DynamoDB streams
      const cfnTable = table.node.defaultChild as any;
      if (cfnTable && cfnTable.addPropertyOverride) {
        cfnTable.addPropertyOverride('StreamSpecification', {
          StreamViewType: StreamViewType.NEW_AND_OLD_IMAGES
        });
        
        // Add event source
        lambdaFunction.addEventSource(
          new DynamoEventSource(table, {
            startingPosition: StartingPosition.LATEST,
            batchSize: 10,
            retryAttempts: 3
          })
        );
        
        // Grant stream permissions
        table.grantStreamRead(lambdaFunction);
      }
    }
  });
}