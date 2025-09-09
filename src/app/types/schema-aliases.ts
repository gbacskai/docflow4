// Type aliases to maintain compatibility with existing components
// Maps external types to the old Schema model types

import type { Schema } from '../../../amplify/data/resource';

export type SchemaUser = Schema['ExternalUser'];
export type SchemaProject = Schema['ExternalProject'];
export type SchemaDocument = Schema['ExternalDocument'];
export type SchemaDocumentType = Schema['ExternalDocumentType'];  
export type SchemaWorkflow = Schema['ExternalWorkflow'];
export type SchemaChatRoom = Schema['ExternalChatRoom'];
export type SchemaChatMessage = Schema['ExternalChatMessage'];

// Utility type for backwards compatibility
export interface LegacySchema {
  User: { type: SchemaUser };
  Project: { type: SchemaProject };
  Document: { type: SchemaDocument };
  DocumentType: { type: SchemaDocumentType };
  Workflow: { type: SchemaWorkflow };
  ChatRoom: { type: SchemaChatRoom };
  ChatMessage: { type: SchemaChatMessage };
}