#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Amplify } = require('aws-amplify');
const { generateClient } = require('aws-amplify/data');

// Read amplify_outputs.json
const amplifyOutputsPath = path.join(__dirname, '..', 'amplify_outputs.json');
const amplifyOutputs = JSON.parse(fs.readFileSync(amplifyOutputsPath, 'utf8'));

// Configure Amplify
Amplify.configure(amplifyOutputs);

// Read backup file
const backupPath = path.join(__dirname, '..', 'data', 'docflow4-backup-documentTypes-workflows-projects-documents-2025-09-03.json');
const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

console.log(`📦 Backup file loaded: ${path.basename(backupPath)}`);
console.log(`📅 Export date: ${backupData.exportDate}`);
console.log(`👤 Exported by: ${backupData.exportedBy}`);

async function restoreData() {
  try {
    const client = generateClient();
    const results = {
      documentTypes: { created: 0, skipped: 0, errors: [] },
      workflows: { created: 0, skipped: 0, errors: [] },
      projects: { created: 0, skipped: 0, errors: [] },
      documents: { created: 0, skipped: 0, errors: [] }
    };

    console.log('\n🔄 Starting data restoration...\n');

    // Restore DocumentTypes
    if (backupData.tables.DocumentTypes) {
      console.log(`📋 Restoring ${backupData.tables.DocumentTypes.length} DocumentTypes...`);
      
      for (const docType of backupData.tables.DocumentTypes) {
        try {
          await client.models.DocumentType.create({
            id: docType.id,
            name: docType.name,
            identifier: docType.identifier,
            definition: docType.definition,
            validationRules: docType.validationRules,
            category: docType.category,
            fields: docType.fields || [],
            isActive: docType.isActive,
            usageCount: docType.usageCount || 0,
            templateCount: docType.templateCount,
            createdAt: docType.createdAt,
            updatedAt: docType.updatedAt
          });
          results.documentTypes.created++;
          console.log(`   ✅ Created: ${docType.name}`);
        } catch (error) {
          if (error.message?.includes('DuplicateKeyException') || error.message?.includes('already exists')) {
            results.documentTypes.skipped++;
            console.log(`   ⏭️  Skipped: ${docType.name} (already exists)`);
          } else {
            results.documentTypes.errors.push(`${docType.name}: ${error.message}`);
            console.log(`   ❌ Error: ${docType.name} - ${error.message}`);
          }
        }
      }
    }

    // Restore Workflows  
    if (backupData.tables.Workflows) {
      console.log(`\n⚡ Restoring ${backupData.tables.Workflows.length} Workflows...`);
      
      for (const workflow of backupData.tables.Workflows) {
        try {
          await client.models.Workflow.create({
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            rules: workflow.rules || [],
            isActive: workflow.isActive,
            usageCount: workflow.usageCount || 0,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt
          });
          results.workflows.created++;
          console.log(`   ✅ Created: ${workflow.name}`);
        } catch (error) {
          if (error.message?.includes('DuplicateKeyException') || error.message?.includes('already exists')) {
            results.workflows.skipped++;
            console.log(`   ⏭️  Skipped: ${workflow.name} (already exists)`);
          } else {
            results.workflows.errors.push(`${workflow.name}: ${error.message}`);
            console.log(`   ❌ Error: ${workflow.name} - ${error.message}`);
          }
        }
      }
    }

    // Restore Projects
    if (backupData.tables.Projects) {
      console.log(`\n📁 Restoring ${backupData.tables.Projects.length} Projects...`);
      
      for (const project of backupData.tables.Projects) {
        try {
          await client.models.Project.create({
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            ownerId: project.ownerId,
            workflowId: project.workflowId,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          });
          results.projects.created++;
          console.log(`   ✅ Created: ${project.name}`);
        } catch (error) {
          if (error.message?.includes('DuplicateKeyException') || error.message?.includes('already exists')) {
            results.projects.skipped++;
            console.log(`   ⏭️  Skipped: ${project.name} (already exists)`);
          } else {
            results.projects.errors.push(`${project.name}: ${error.message}`);
            console.log(`   ❌ Error: ${project.name} - ${error.message}`);
          }
        }
      }
    }

    // Restore Documents
    if (backupData.tables.Documents) {
      console.log(`\n📄 Restoring ${backupData.tables.Documents.length} Documents...`);
      
      for (const document of backupData.tables.Documents) {
        try {
          await client.models.Document.create({
            id: document.id,
            name: document.name,
            status: document.status,
            projectId: document.projectId,
            documentType: document.documentType,
            formData: document.formData,
            uploaderId: document.uploaderId,
            filePath: document.filePath,
            fileSize: document.fileSize,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt
          });
          results.documents.created++;
          console.log(`   ✅ Created: ${document.name}`);
        } catch (error) {
          if (error.message?.includes('DuplicateKeyException') || error.message?.includes('already exists')) {
            results.documents.skipped++;
            console.log(`   ⏭️  Skipped: ${document.name} (already exists)`);
          } else {
            results.documents.errors.push(`${document.name}: ${error.message}`);
            console.log(`   ❌ Error: ${document.name} - ${error.message}`);
          }
        }
      }
    }

    console.log('\n📊 Restoration Summary:');
    console.log(`   DocumentTypes: ${results.documentTypes.created} created, ${results.documentTypes.skipped} skipped, ${results.documentTypes.errors.length} errors`);
    console.log(`   Workflows: ${results.workflows.created} created, ${results.workflows.skipped} skipped, ${results.workflows.errors.length} errors`);
    console.log(`   Projects: ${results.projects.created} created, ${results.projects.skipped} skipped, ${results.projects.errors.length} errors`);
    console.log(`   Documents: ${results.documents.created} created, ${results.documents.skipped} skipped, ${results.documents.errors.length} errors`);
    
    if (results.documentTypes.errors.length > 0 || results.workflows.errors.length > 0 || 
        results.projects.errors.length > 0 || results.documents.errors.length > 0) {
      console.log('\n❌ Errors occurred during restoration:');
      [...results.documentTypes.errors, ...results.workflows.errors, ...results.projects.errors, ...results.documents.errors]
        .forEach(error => console.log(`   • ${error}`));
    }

  } catch (error) {
    console.error('❌ Error during data restoration:', error);
    process.exit(1);
  }
}

restoreData();