const fs = require('fs');
const path = require('path');

// Target files that exceed Angular's budget (20kB)
const targetFiles = [
  'src/app/projects/projects.less',
  'src/app/documents/documents.less', 
  'src/app/users/users.less',
  'src/app/document-types/document-types.less'
];

function optimizeWithMixins(content, filename) {
  // Add import for shared styles if not present
  if (!content.includes('@import \'../shared-styles.less\'')) {
    content = '@import \'../shared-styles.less\';\n' + content.replace('@import \'../../styles.less\';', '');
  }

  let optimized = content
    // Replace repeated page header patterns
    .replace(/\.page-header\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;[^}]*align-items:\s*center;[^}]*margin-bottom:\s*2rem;[^}]*h1\s*\{[^}]*font-size:\s*2\.5rem;[^}]*\}/g, 
             '.page-header{.page-header-mixin();}')
    
    // Replace card patterns
    .replace(/background:\s*white;[^}]*border-radius:\s*12px;[^}]*box-shadow:[^}]*padding:\s*1\.5rem[^}]*transform:[^}]*translateX?\([^)]+\);[^}]*box-shadow:[^}]*/g,
             '.card-mixin();')
             
    // Replace form header patterns
    .replace(/\.form-header\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;[^}]*align-items:\s*center;[^}]*margin-bottom:\s*1\.5rem[^}]*h2\s*\{[^}]*color:\s*#2c3e50;[^}]*margin:\s*0;[^}]*font-size:\s*1\.5rem;[^}]*font-weight:\s*500[^}]*\}/g,
             '.form-header{.form-header-mixin();}')
             
    // Replace form group patterns
    .replace(/\.form-group\s*\{[^}]*margin-bottom:\s*1rem[^}]*label\s*\{[^}]*display:\s*block[^}]*margin-bottom:\s*0\.5rem[^}]*color:\s*#2c3e50[^}]*font-weight:\s*500[^}]*\}[^}]*input,[^}]*textarea,[^}]*select\s*\{[^}]*width:\s*100%;[^}]*padding:\s*0\.75rem[^}]*\}/g,
             '.form-group{.form-group-mixin();}')
    
    // Replace button patterns with mixins
    .replace(/\.btn-primary\s*\{[^}]*padding:\s*0\.75rem\s+1\.5rem;[^}]*background:\s*#3498db[^}]*\}/g, '.btn-primary{.btn-primary-mixin();}')
    .replace(/\.btn-success\s*\{[^}]*padding:\s*0\.75rem\s+1\.5rem;[^}]*background:\s*#27ae60[^}]*\}/g, '.btn-success{.btn-success-mixin();}')
    .replace(/\.btn-warning\s*\{[^}]*padding:\s*0\.75rem\s+1\.5rem;[^}]*background:\s*#f39c12[^}]*\}/g, '.btn-warning{.btn-warning-mixin();}')
    .replace(/\.btn-danger\s*\{[^}]*padding:\s*0\.75rem\s+1\.5rem;[^}]*background:\s*#e74c3c[^}]*\}/g, '.btn-danger{.btn-danger-mixin();}')
    
    // Replace sidebar patterns
    .replace(/\.sidebar-overlay\s*\{[^}]*position:\s*fixed;[^}]*top:\s*0;[^}]*left:\s*0;[^}]*right:\s*0;[^}]*bottom:\s*0;[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);[^}]*z-index:\s*1000[^}]*\}/g,
             '.sidebar-overlay{.sidebar-base-mixin();}')
             
    // Remove comments and compress whitespace
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*{\s*/g, '{')
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*,\s*/g, ',')
    
    // Remove empty rules
    .replace(/[^{}]+\{\s*\}/g, '')
    
    // Final cleanup
    .trim();

  return optimized;
}

console.log('🎯 Starting mixin-based CSS optimization for Angular budget compliance...\n');

targetFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const originalContent = fs.readFileSync(file, 'utf8');
    const originalSize = Buffer.byteLength(originalContent, 'utf8');
    
    // Create backup
    fs.writeFileSync(file + '.backup', originalContent);
    
    try {
      // Optimize
      const optimizedContent = optimizeWithMixins(originalContent, file);
      
      const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');
      
      // Write optimized version
      fs.writeFileSync(file, optimizedContent);
      
      const savings = originalSize - optimizedSize;
      const savingsPercent = ((savings / originalSize) * 100).toFixed(1);
      
      console.log(`📁 ${file}`);
      console.log(`   Original: ${originalSize.toLocaleString()} bytes`);
      console.log(`   Optimized: ${optimizedSize.toLocaleString()} bytes`);
      console.log(`   Saved: ${savings.toLocaleString()} bytes (${savingsPercent}%)`);
      console.log(`   Status: ${optimizedSize > 20480 ? '❌ Still over 20kB limit' : '✅ Under 20kB limit'}\n`);
      
    } catch (error) {
      console.error(`❌ Error optimizing ${file}:`, error.message);
      // Restore original if optimization failed
      fs.writeFileSync(file, originalContent);
      console.log(`   Restored original file due to optimization error\n`);
    }
  }
});

console.log('✨ Mixin-based CSS optimization complete! Testing build...');