# DocFlow4 UI Style Guide

## Overview
This comprehensive style guide establishes consistent visual design patterns, component styles, and layout principles for the DocFlow4 document management system. Built on Angular 20 with LESS preprocessor and Light Bootstrap Dashboard theme.

## Design System Foundation

### Color Palette

#### Primary Colors
- **Primary Blue**: `#3472F7` - Main brand color for primary actions, links, focus states
- **Success Green**: `#87CB16` - Success states, active statuses, positive actions
- **Info Cyan**: `#1DC7EA` - Information messages, secondary highlights
- **Warning Orange**: `#FF9500` - Warning states, caution indicators
- **Danger Red**: `#FF4A55` - Error states, delete actions, alerts

#### Secondary Colors
- **Azure**: `#23CCEF` - Accent color for highlights
- **Purple**: `#9368E9` - Special indicators, badges
- **Green Alt**: `#27ae60` - Alternative green for charts/stats
- **Blue Alt**: `#447DF7` - Alternative blue for variations

#### Neutral Colors
- **White**: `#FFFFFF` - Card backgrounds, form controls
- **Light Gray**: `#E3E3E3` - Borders, dividers
- **Medium Gray**: `#DDDDDD` - Disabled states, subtle borders
- **Dark Gray**: `#9A9A9A` - Muted text, secondary info
- **Black**: `#333333` - Primary text, headings
- **Background**: `#f4f3ef` - Page background, warm neutral

### Typography

#### Font Family
- **Primary**: "Helvetica Neue", Helvetica, Arial, sans-serif
- **Monospace**: 'Monaco', 'Consolas', 'Courier New', monospace (for code/JSON)

#### Font Weights
- **Light**: 300 - Large headings, elegant text
- **Normal**: 400 - Body text, default weight
- **Semi-bold**: 500 - Labels, form labels, emphasized text
- **Bold**: 600 - Buttons, important highlights

#### Typography Scale
- **H1**: 52px - Page titles, hero headings
- **H2**: 36px - Section headings, card titles
- **H3**: 28px - Subsection headings, modal titles
- **H4**: 22px - Component headings
- **H5**: 16px - Form section labels
- **H6**: 14px - Small headings, labels
- **Body**: 14px - Default text size
- **Small**: 12px - Meta text, help text

### Spacing System

#### Base Units
- **Base**: 1rem (16px)
- **Small**: 0.5rem (8px)
- **Medium**: 1rem (16px)
- **Large**: 1.5rem (24px)
- **XLarge**: 2rem (32px)

#### Component Spacing
- **Padding Standard**: 1.5rem (24px) - Cards, modals, forms
- **Padding Compact**: 0.75rem (12px) - Buttons, small components
- **Margin Bottom**: 2rem (32px) - Card separation, section spacing
- **Grid Gap**: 1rem-2rem (16px-32px) - Layout grid spacing

### Border Radius
- **Small**: 3px - Badges, small elements
- **Base**: 4px - Buttons, form controls
- **Large**: 6px - Cards, modals
- **Extra Large**: 12px - Major cards, containers

### Box Shadows
- **Subtle**: `0 2px 4px rgba(0, 0, 0, 0.1)` - Default cards
- **Medium**: `0 4px 8px rgba(0, 0, 0, 0.15)` - Hover states
- **Strong**: `0 8px 16px rgba(0, 0, 0, 0.15)` - Elevated elements
- **Focus**: `0 0 0 2px rgba(52, 114, 247, 0.2)` - Focus indicators

### Transitions
- **Base**: `all 300ms ease` - Default transitions
- **Fast**: `all 150ms ease` - Quick interactions
- **Slow**: `all 370ms ease` - Complex animations

## Component Patterns

### Cards
#### Standard Card
```less
.card {
  background-color: #FFFFFF;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 2rem;
  transition: all 300ms ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
}
```

#### Accented Card
- **Left Border**: 4px solid primary color
- **States**: Editing (orange), Inactive (gray)
- **Hover**: Enhanced elevation with transform

#### Dashboard Cards
- **KPI Cards**: Icon + number + label layout
- **Chart Cards**: 2rem padding, structured headers
- **Grid Layout**: Responsive auto-fit minmax(200px, 1fr)

### Buttons

#### Primary Actions
```less
.btn-primary {
  background-color: #3472F7;
  color: #FFFFFF;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 300ms ease;
  
  &:hover:not(:disabled) {
    background-color: darken(#3472F7, 10%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
}
```

#### Button Variants
- **Success**: #87CB16 background
- **Warning**: #FF9500 background  
- **Danger**: #FF4A55 background
- **Secondary**: #6c757d background
- **Small**: 0.4rem 0.75rem padding, 0.8rem font-size

#### Interactive Patterns
- **Hover**: translateY(-1px) + enhanced shadow
- **Active**: translateY(0) - returns to baseline
- **Focus**: 2px primary color outline with 0.2 opacity
- **Disabled**: 0.6 opacity + not-allowed cursor

### Forms

#### Form Controls
```less
.form-control {
  padding: 0.75rem;
  border: 1px solid #E3E3E3;
  border-radius: 4px;
  font-size: 14px;
  width: 100%;
  transition: all 300ms ease;
  
  &:focus {
    outline: none;
    border-color: #3472F7;
    box-shadow: 0 0 0 2px rgba(52, 114, 247, 0.2);
  }
}
```

#### Form Groups
- **Label**: Semi-bold weight, block display, 0.5rem bottom margin
- **Help Text**: 0.85rem size, italic, muted color
- **Error Message**: Danger color, red background, bordered

#### Specialized Inputs
- **Definition Textarea**: Monaco font, 250px min-height, full width
- **Validation Rules**: Courier New font, monospace styling
- **Search Inputs**: Relative positioning for clear buttons

### Navigation & Headers

#### Page Headers
Standard layout pattern for all page headers with consistent positioning:

```less
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 10px;
  
  h1 {
    font-size: 2.5rem;
    color: #2c3e50;
    margin: 0;
    font-weight: 300;
  }
}
```

#### Header Structure Pattern
All pages follow this consistent header layout:

```html
<header class="page-header">
  <!-- Left side: Page title or title section -->
  <div class="title-section">
    <h1>Page Title</h1>
    <!-- Optional: Filter buttons or secondary actions -->
  </div>
  
  <!-- Right side: Header actions -->
  <div class="header-actions">
    <!-- Search input (if applicable) -->
    <div class="search-wrapper">
      <input type="text" class="search-input" placeholder="Search..."/>
      <button class="clear-search-btn">✕</button>
    </div>
    
    <!-- Primary action button -->
    <button class="add-button">+ New Item</button>
  </div>
</header>
```

#### Header Actions Layout
```less
.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}
```

#### Search Bar Positioning
- **Container**: `.search-wrapper` with relative positioning
- **Input Width**: 300px for header search, 100% for sidebar search
- **Clear Button**: Absolutely positioned at right: 0.5rem
- **Focus State**: Primary color border with subtle shadow

```less
.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  
  .search-input {
    width: 300px; // Header search
    padding: 0.75rem 1rem;
    padding-right: 2.5rem; // Space for clear button
  }
  
  .clear-search-btn {
    position: absolute;
    right: 0.5rem;
  }
}
```

#### Primary Action Button
- **Class**: `.add-button`
- **Position**: Rightmost in header-actions
- **Style**: Primary color background with hover effects
- **Text Pattern**: "+ New [ItemType]"

```less
.add-button {
  background: #3472F7;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  
  &:hover {
    background: darken(#3472F7, 10%);
    transform: translateY(-1px);
  }
}
```

#### Dashboard Header
- **Gradient Background**: Linear gradient from #667eea to #764ba2
- **White Text**: Full white text treatment
- **Flex Layout**: Space-between with responsive stacking

### Status Indicators

#### Status Badges
```less
.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: capitalize;
}
```

#### Status Colors
- **Active/Requested**: Light green background (#d4edda), dark green text
- **Inactive/Rejected**: Light red background (#f8d7da), dark red text  
- **Archived/Provided**: Light gray background, dark gray text
- **Review/Accepted**: Light orange background, dark orange text
- **Approved/Published**: Light cyan background, dark cyan text

### Layout Patterns

#### Responsive Grid
```less
.row {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -15px;
}

.col {
  padding: 0 15px;
  flex: 1;
}
```

#### Column Sizes
- **col-2**: 16.666667% - Sidebar elements
- **col-3**: 25% - Quarter width
- **col-4**: 33.333333% - Third width  
- **col-6**: 50% - Half width
- **col-8**: 66.666667% - Two-thirds width
- **col-12**: 100% - Full width

#### Page Container
- **Max Width**: 1200px
- **Center**: margin: 0 auto
- **Padding**: 0 15px horizontal

### Interactive Elements

#### Hover States
- **Cards**: translateY(-2px) + enhanced shadow
- **Buttons**: translateY(-1px) + color darkening
- **List Items**: Background color change + border shift

#### Loading States
```less
.loading {
  text-align: center;
  padding: 3rem;
  color: #9A9A9A;
  font-size: 1.2rem;
}
```

#### Empty States
- **Centered Text**: Same styling as loading
- **Italic Font**: Subtle styling difference
- **Muted Color**: #9A9A9A for reduced prominence

## Responsive Design

### Breakpoints
- **Mobile**: max-width: 768px
- **Tablet**: max-width: 1024px
- **Desktop**: 1025px and above

### Mobile Adaptations
- **Grid Collapse**: Multi-column layouts become single column
- **Font Scaling**: Reduced font sizes for headers
- **Padding Reduction**: Tighter spacing on small screens
- **Flex Direction**: Column layouts on mobile

### Dashboard Responsive
- **KPI Cards**: Vertical centering, smaller numbers
- **Activity Items**: Column layout, stacked information
- **Grid Templates**: Single column on mobile

## Animation & Transitions

### Micro-interactions
- **Transform Timing**: 300ms ease for smooth feel
- **Stagger**: 150ms fast for quick feedback
- **Color Transitions**: 300ms ease for brand consistency

### Animation Principles
- **Subtle Movement**: Small translateY movements (1-2px)
- **Consistent Easing**: Use 'ease' for natural feel
- **Performance**: Transform and opacity only for smooth performance

## Accessibility

### Color Contrast
- **Primary on White**: WCAG AA compliant
- **Text on Backgrounds**: Ensure 4.5:1 minimum ratio
- **Status Colors**: Tested for colorblind accessibility

### Focus Indicators
- **Visible**: 2px outline with primary color
- **High Contrast**: Sufficient contrast against all backgrounds
- **Consistent**: Same pattern across all interactive elements

### Typography
- **Readable Sizes**: Minimum 14px for body text
- **Line Height**: 1.5 for optimal readability
- **Contrast**: Dark text on light backgrounds

## Implementation Guidelines

### CSS/LESS Structure
1. **Import Base**: Always import main styles.less
2. **Component Mixins**: Use shared-styles.less mixins
3. **Consistent Classes**: Follow established naming patterns
4. **Responsive First**: Include responsive breakpoints

### Component Development
1. **Signal Integration**: Work with Angular signals
2. **Form Patterns**: Follow enhanced form group patterns  
3. **Loading States**: Include loading and empty states
4. **Error Handling**: Consistent error display patterns

### Testing Considerations
1. **Visual Consistency**: Test across breakpoints
2. **Interactive States**: Test hover, focus, disabled
3. **Accessibility**: Test keyboard navigation and screen readers
4. **Performance**: Test animation performance on low-end devices

This style guide ensures visual consistency across the DocFlow4 application while maintaining flexibility for component-specific needs.