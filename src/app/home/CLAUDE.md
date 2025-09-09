# Home Component

This directory contains the home page component for authenticated users.

## Purpose
Serves as the primary landing page for authenticated users with overview and navigation functionality.

## Files
- `home.ts` - Home component with user welcome and navigation
- `home.html` - Home page template with user dashboard elements
- `home.less` - Home page styling and layout
- `home.spec.ts` - Unit tests for home functionality

## Key Features
- **User Welcome** - Personalized greeting for authenticated users
- **Feature Overview** - Quick access to main application features
- **Navigation Hub** - Central point for accessing different app sections

## Access Control
- **Authentication Required** - Protected by `authGuard` route guard
- **User Context** - Displays user-specific information and options

## Related Components
- Dashboard: Alternative main landing page for authenticated users
- Navigation: Uses main navigation component for consistent UI