#!/usr/bin/env node

/**
 * Setup script to configure environment variables for consistent Amplify table naming
 * across all resources (GraphQL models and custom DynamoDB tables)
 */

const fs = require('fs');
const path = require('path');

function setupEnvironment() {
  // Get the current git branch
  const { execSync } = require('child_process');
  
  let currentBranch;
  try {
    currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.warn('Could not determine git branch, using "dev" as default');
    currentBranch = 'dev';
  }

  // Create .env file with environment configuration
  const envContent = `# Amplify Environment Configuration
# This ensures consistent table naming across all resources
AMPLIFY_BRANCH=${currentBranch}
CDK_DEFAULT_ENV=${currentBranch}

# AWS Branch variable (out-of-the-box)
AWS_BRANCH=${currentBranch}

# App configuration
APP_NAME=docflow4
`;

  const envPath = path.join(process.cwd(), '.env');
  
  fs.writeFileSync(envPath, envContent);
  
  console.log(`✅ Environment configured for branch: ${currentBranch}`);
  console.log(`📝 Created .env file with ENV=${currentBranch}`);
  console.log('');
  console.log('Table naming pattern will be:');
  console.log(`- Custom DynamoDB: docflow4-TableName-${currentBranch}`);
  console.log(`- GraphQL Models: ModelName-[AppSyncId]-${currentBranch}`);
  console.log(`- Storage: docflow4-${currentBranch}`);
  console.log('');
  console.log('To use with Amplify sandbox:');
  console.log(`npx ampx sandbox --profile aws_amplify_docflow4 --identifier 00003`);
}

// Run if called directly
if (require.main === module) {
  setupEnvironment();
}

module.exports = { setupEnvironment };