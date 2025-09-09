import { Stack } from 'aws-cdk-lib';
import { Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { StartingPosition, EventSourceMapping } from 'aws-cdk-lib/aws-lambda';
import { StreamViewType } from 'aws-cdk-lib/aws-dynamodb';

export function configureStreamTriggers(
  scope: any, 
  lambdaFunction: any, 
  tables: Record<string, any>
) {
  const tableNames = ['Project', 'Document', 'User', 'DocumentType', 'Workflow', 'ChatRoom', 'ChatMessage'];
  
  tableNames.forEach(tableName => {
    const table = tables[tableName];
    if (table) {
      console.log(`Configuring DynamoDB stream for table: ${tableName}`);
      
      // Enable DynamoDB streams using the proper Amplify Gen2 approach
      const cfnTable = table.node.defaultChild as any;
      if (cfnTable) {
        cfnTable.addPropertyOverride('StreamSpecification', {
          StreamViewType: StreamViewType.NEW_AND_OLD_IMAGES
        });
        
        console.log(`Stream enabled for table: ${tableName}`);
        
        // Use CDK's built-in method to grant stream permissions
        table.grantStreamRead(lambdaFunction);
        table.grantReadWriteData(lambdaFunction);
        
        // Create EventSourceMapping using the table's stream ARN property
        const eventSourceMapping = new EventSourceMapping(scope, `${tableName}StreamMapping`, {
          target: lambdaFunction,
          eventSourceArn: table.tableStreamArn,
          startingPosition: StartingPosition.LATEST,
          batchSize: 10,
          retryAttempts: 3
        });
        
        console.log(`EventSourceMapping created for table: ${tableName}`);
        console.log(`Permissions granted for table: ${tableName}`);
      }
    }
  });
}