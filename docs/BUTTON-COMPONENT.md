# Button Component Documentation

## Overview

The app now uses a standardized `Button` component for consistent sizing, styling, and behavior across the application. This ensures all buttons have the same look and feel, predictable interaction patterns, and proper accessibility support.

## Usage

Import the Button component:

```tsx
import { Button } from '../components/Button';
```

### Basic Examples

```tsx
// Primary button (main actions)
<Button variant="primary" size="md" onClick={handleSave}>
  Save
</Button>

// Secondary button (less prominent actions)
<Button variant="secondary" size="md" onClick={handleCancel}>
  Cancel
</Button>

// Danger button (destructive actions)
<Button variant="danger" size="md" onClick={handleDelete}>
  Delete
</Button>

// With icon
<Button 
  variant="primary" 
  size="lg"
  icon={<FontAwesomeIcon icon={faPlus} />}
  onClick={handleAdd}
>
  Add Games
</Button>

// Loading state
<Button 
  variant="primary" 
  size="md"
  loading={isLoading}
  onClick={handleSubmit}
>
  Submit
</Button>

// Full width
<Button variant="primary" size="md" fullWidth>
  Continue
</Button>

// Icon only (no text)
<Button
  variant="ghost"
  size="sm"
  icon={<FontAwesomeIcon icon={faEdit} />}
  onClick={handleEdit}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost' \| 'link'` | `'primary'` | Visual style variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `icon` | `ReactNode` | `undefined` | Icon to display |
| `iconPosition` | `'left' \| 'right'` | `'left'` | Position of icon relative to text |
| `loading` | `boolean` | `false` | Shows loading spinner and disables button |
| `fullWidth` | `boolean` | `false` | Makes button full width |
| `disabled` | `boolean` | `false` | Disables the button |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | HTML button type |
| `className` | `string` | `''` | Additional CSS classes |
| `children` | `ReactNode` | `undefined` | Button text/content |

All standard HTML button attributes are also supported.

## Variants

### Primary
- **Use for**: Main actions, important CTAs
- **Appearance**: Red gradient background (Nintendo brand color)
- **Example**: "Add Games", "Save Changes", "Sign In"

### Secondary
- **Use for**: Less prominent actions, cancel buttons
- **Appearance**: Gray background with border
- **Example**: "Cancel", "Back", "Close"

### Danger
- **Use for**: Destructive actions that need extra attention
- **Appearance**: Red background
- **Example**: "Delete", "Remove", "Sign Out"

### Ghost
- **Use for**: Minimal actions, icon-only buttons
- **Appearance**: Transparent background, hover effect
- **Example**: Edit icons, close buttons, toolbar actions

### Link
- **Use for**: Text-based actions that look like links
- **Appearance**: No background, colored text
- **Example**: "Forgot password?", "Learn more"

## Sizes

### Small (`sm`)
- Padding: `0.5rem 1rem`
- Font size: `0.875rem`
- **Use for**: Compact spaces, toolbars, inline actions

### Medium (`md`)
- Padding: `0.75rem 1.5rem`
- Font size: `0.9375rem`
- **Use for**: Standard buttons in forms and modals (default)

### Large (`lg`)
- Padding: `0.875rem 1.75rem`
- Font size: `1rem`
- **Use for**: Primary page actions, hero CTAs

## Special Variants

The Button component also supports special styling through className:

### GitHub Button
```tsx
<Button className="btn-github" size="lg" icon={<GitHubIcon />}>
  Continue with GitHub
</Button>
```

### Share Button
```tsx
<Button className="btn-share" size="lg" icon={<FontAwesomeIcon icon={faLink} />}>
  Share
</Button>
```

### Info/Search Button
```tsx
<Button className="btn-info" size="lg" icon={<FontAwesomeIcon icon={faSearch} />}>
  Search
</Button>
```

## Migration Guide

### Old Pattern
```tsx
<button className="btn-add" onClick={handleAdd}>
  + Add Games
</button>
```

### New Pattern
```tsx
<Button 
  variant="primary" 
  size="lg"
  icon={<FontAwesomeIcon icon={faPlus} />}
  onClick={handleAdd}
>
  Add Games
</Button>
```

## Accessibility

The Button component includes:
- ✅ Proper focus states (outline on `:focus-visible`)
- ✅ Disabled state styling and cursor
- ✅ ARIA-friendly loading states
- ✅ Icons marked as `aria-hidden="true"`
- ✅ Keyboard navigation support

## Legacy Styles

Some components still use legacy button classes (`.btn-add`, `.btn-cancel`, `.btn-submit`, etc.). These are marked with comments in CSS files and should be migrated to the Button component over time.

## Migration Status

### ✅ Migrated Components
- Library page
- Settings page
- EditGameModal
- ShareLibraryModal

### ⏳ Pending Migration
- Search page
- Auth page (custom styling)
- Other modal components
- Friends page
- Compare page
- GameDetails page

## Best Practices

1. **Use semantic variants**: Choose the variant that matches the action's importance
2. **Consistent sizing**: Use `md` for most forms/modals, `lg` for primary page actions
3. **Loading states**: Always show loading state for async operations
4. **Icon placement**: Left is default, use right for "next" actions
5. **Accessibility**: Provide aria-label for icon-only buttons
6. **Full width**: Use sparingly, mainly for mobile layouts

## Examples in the Codebase

See these files for examples:
- `src/pages/Library.tsx` - Header actions, empty state, delete modal
- `src/pages/Settings.tsx` - Form actions, account management
- `src/components/EditGameModal.tsx` - Modal actions
- `src/components/ShareLibraryModal.tsx` - Complex form with multiple button states
