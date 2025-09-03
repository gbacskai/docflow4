# Public Assets Directory

This directory contains static assets that are served directly by the web server without processing.

## Purpose
Houses public assets including the application icon and server configuration files that need to be accessible at the web root.

## Files
- `favicon.ico` - Application favicon displayed in browser tabs and bookmarks
- `_redirects` - Netlify/AWS Amplify redirect configuration for single-page application routing

## Key Features

### Static Asset Serving
- **Direct Access** - Files served directly at web root without Angular processing
- **Browser Caching** - Static files cached by browsers for performance
- **Build Integration** - Copied to build output during Angular build process

### SPA Configuration
- **`_redirects` File** - Ensures proper single-page application routing on Amplify
- **Fallback Routing** - All unmatched routes redirect to index.html for Angular routing
- **Server Configuration** - Deployment-specific routing rules

## Build Process
- Files copied to `dist/` directory during `ng build`
- Maintains directory structure in production build
- No compilation or processing applied to these assets

## Deployment Integration
- **AWS Amplify** - `_redirects` file configures Amplify hosting behavior
- **SPA Support** - Ensures Angular routing works correctly in production
- **Asset Delivery** - Favicon and other assets served efficiently

## Related Configuration
- Build process defined in `angular.json`
- Amplify deployment configured in `amplify.yml`
- Static asset handling in Angular build configuration