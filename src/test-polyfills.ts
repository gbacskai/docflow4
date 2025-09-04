// Polyfills required for AWS Amplify modules in test environment
import 'zone.js';
import 'zone.js/testing';

// Define global object for Node.js modules
if (typeof (global as any) === 'undefined') {
  (globalThis as any).global = globalThis;
}

// Additional polyfills for AWS SDK compatibility
if (typeof (process as any) === 'undefined') {
  (globalThis as any).process = { env: {} };
}