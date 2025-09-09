import { Injectable } from '@angular/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

@Injectable({
  providedIn: 'root'
})
export class DirectDynamoDBService {
  private client!: DynamoDBDocumentClient;
  private readonly TABLE_PREFIX = 'docflow4';
  private readonly ENVIRONMENT = 'sandbox-00009'; // This should match the current environment

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      // Get AWS credentials from Amplify
      const session = await fetchAuthSession();
      const credentials = session.credentials;
      
      if (!credentials) {
        throw new Error('No AWS credentials available');
      }

      // Create DynamoDB client
      const dynamoClient = new DynamoDBClient({
        region: 'ap-southeast-2', // Match the region from amplify_outputs.json
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      });

      this.client = DynamoDBDocumentClient.from(dynamoClient);
      console.log('✅ Direct DynamoDB client initialized');
    } catch (error) {
      console.error('❌ Error initializing DynamoDB client:', error);
    }
  }

  /**
   * Get the table name for a given model type
   */
  private getTableName(modelType: string): string {
    return `${this.TABLE_PREFIX}-${modelType}-${this.ENVIRONMENT}`;
  }

  /**
   * Put an item directly into the custom DynamoDB table
   */
  async putItem(modelType: string, item: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const tableName = this.getTableName(modelType);
      console.log(`📝 Writing directly to table: ${tableName}`, item);

      const command = new PutCommand({
        TableName: tableName,
        Item: item
      });

      await this.client.send(command);
      
      console.log(`✅ Successfully wrote to ${tableName}`);
      return { success: true, data: item };
    } catch (error: any) {
      console.error(`❌ Error writing to ${modelType} table:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get an item by primary key
   */
  async getItem(modelType: string, id: string, version: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const tableName = this.getTableName(modelType);
      
      const command = new GetCommand({
        TableName: tableName,
        Key: { id, version }
      });

      const result = await this.client.send(command);
      
      return { success: true, data: result.Item };
    } catch (error: any) {
      console.error(`❌ Error reading from ${modelType} table:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Scan all items from a table
   */
  async scanItems(modelType: string, filter?: any): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const tableName = this.getTableName(modelType);
      
      const command = new ScanCommand({
        TableName: tableName,
        FilterExpression: filter?.expression,
        ExpressionAttributeValues: filter?.values
      });

      const result = await this.client.send(command);
      
      return { success: true, data: result.Items || [] };
    } catch (error: any) {
      console.error(`❌ Error scanning ${modelType} table:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an item
   */
  async updateItem(modelType: string, id: string, version: string, updates: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const tableName = this.getTableName(modelType);
      
      // Build update expression
      const updateExpression = Object.keys(updates).map(key => `#${key} = :${key}`).join(', ');
      const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
        acc[`#${key}`] = key;
        return acc;
      }, {} as any);
      const expressionAttributeValues = Object.keys(updates).reduce((acc, key) => {
        acc[`:${key}`] = updates[key];
        return acc;
      }, {} as any);

      const command = new UpdateCommand({
        TableName: tableName,
        Key: { id, version },
        UpdateExpression: `SET ${updateExpression}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      });

      const result = await this.client.send(command);
      
      return { success: true, data: result.Attributes };
    } catch (error: any) {
      console.error(`❌ Error updating ${modelType} table:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an item
   */
  async deleteItem(modelType: string, id: string, version: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const tableName = this.getTableName(modelType);
      
      const command = new DeleteCommand({
        TableName: tableName,
        Key: { id, version }
      });

      await this.client.send(command);
      
      return { success: true };
    } catch (error: any) {
      console.error(`❌ Error deleting from ${modelType} table:`, error);
      return { success: false, error: error.message };
    }
  }
}