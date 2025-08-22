# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `npm start` or `ng serve` - serves at http://localhost:4200/
- **Build for production**: `npm run build` or `ng build`
- **Build with watch**: `npm run watch` - development build with file watching
- **Run tests**: `npm test` or `ng test` - runs Karma/Jasmine tests
- **Generate components**: `ng generate component component-name`

## Project Architecture

This is a fresh Angular 20 application using:

- **Angular 20.2.0** with standalone components architecture
- **TypeScript** with strict configuration enabled
- **LESS** preprocessor for styling (configured in angular.json)
- **Karma + Jasmine** for unit testing
- **Signals API** - the main component uses Angular signals (`title = signal('docflow4')`)
- **Modern Angular features**: Standalone components, new control flow syntax (`@for`, `@if`)

### Key Files Structure

- `src/app/app.ts` - Main app component using standalone architecture
- `src/app/app.config.ts` - Application configuration with providers
- `src/app/app.routes.ts` - Routing configuration (currently empty)
- `src/main.ts` - Application bootstrap using `bootstrapApplication`

### Code Style

- **EditorConfig**: 2-space indentation, single quotes for TypeScript
- **Prettier**: Configured with 100 character line width, single quotes, Angular HTML parser
- **TypeScript**: Strict mode enabled with additional strict options (noImplicitReturns, noFallthroughCasesInSwitch, etc.)

### Component Architecture

The app uses Angular's new standalone component approach:
- Components import dependencies directly via `imports` array
- No `NgModule` declarations needed
- Uses signal-based state management instead of traditional property binding

The current app.html template contains the default Angular welcome page with modern styling using CSS custom properties and Angular's new template syntax.