module.exports = {
  content: [
    './src/**/*.html',
    './src/**/*.ts',
    './dist/docflow4/browser/*.html',
    './dist/docflow4/browser/*.js'
  ],
  css: [
    './dist/docflow4/browser/*.css'
  ],
  defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
  safelist: [
    // Angular and framework classes
    /^mat-/,
    /^cdk-/,
    /^ng-/,
    
    // Component state classes
    'active',
    'selected',
    'disabled',
    'error',
    'success',
    'warning',
    'loading',
    'hidden',
    'visible',
    'pending',
    'completed',
    'archived',
    
    // Status and type classes
    /^status-/,
    /^type-/,
    /^mode-/,
    /^btn-/,
    /^action-/,
    /^nav-/,
    
    // Icon and visual classes
    'icon',
    'spinner',
    'loading-spinner',
    'checkmark',
    'close-btn',
    
    // Layout classes
    'container',
    'wrapper',
    'panel',
    'card',
    'grid',
    'flex',
    
    // Form classes
    'form-group',
    'form-row',
    'form-actions',
    'input',
    'textarea',
    'select',
    'label',
    
    // Angular dynamic classes that might be added at runtime
    /\[class\]/,
    /\[ngClass\]/
  ],
  variables: true,
  keyframes: true,
  fontFace: true
};