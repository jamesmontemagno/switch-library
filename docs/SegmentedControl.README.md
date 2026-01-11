# SegmentedControl Component

A reusable, accessible toggle/tab/button group component used throughout the app for consistent UI patterns.

## Features

- ✅ **TypeScript Support**: Full type safety with generics
- ✅ **Accessibility**: Proper ARIA attributes (role="tablist", role="tab", aria-selected)
- ✅ **Responsive**: Mobile-friendly with touch targets
- ✅ **Dark Mode**: Automatic theme support
- ✅ **Variants**: Default (pill), Tabs (underline), Buttons (bordered)
- ✅ **Flexible**: Icon-only, text-only, or combined modes
- ✅ **Counts**: Optional count badges for tabs

## Usage Examples

### Mode Toggle (Search/Trending)
```tsx
<SegmentedControl
  options={[
    { value: 'search', label: 'Search', icon: <SearchIcon /> },
    { value: 'trending', label: 'Trending', icon: <FireIcon /> }
  ]}
  value={mode}
  onChange={setMode}
  ariaLabel="Search mode"
  variant="default"
/>
```

### View Toggle (Icon Only)
```tsx
<SegmentedControl
  options={[
    { value: 'grid', label: 'Grid View', icon: <GridIcon /> },
    { value: 'list', label: 'List View', icon: <ListIcon /> },
    { value: 'compact', label: 'Compact View', icon: <CompactIcon /> }
  ]}
  value={viewMode}
  onChange={setViewMode}
  ariaLabel="View mode"
  variant="buttons"
  size="sm"
  iconOnly
/>
```

### Format Selector (Full Width)
```tsx
<SegmentedControl
  options={[
    { value: 'Physical', label: 'Physical', icon: <BoxIcon /> },
    { value: 'Digital', label: 'Digital', icon: <CloudIcon /> }
  ]}
  value={format}
  onChange={setFormat}
  ariaLabel="Game format"
  variant="buttons"
  fullWidth
/>
```

### Tabs with Counts
```tsx
<SegmentedControl
  options={[
    { value: 'following', label: 'Following', icon: <UserIcon />, count: 42 },
    { value: 'followers', label: 'Followers', icon: <UsersIcon />, count: 18 }
  ]}
  value={activeTab}
  onChange={setActiveTab}
  ariaLabel="Friends tabs"
  variant="tabs"
  fullWidth
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `SegmentedControlOption<T>[]` | Required | Array of options to display |
| `value` | `T` | Required | Currently selected value |
| `onChange` | `(value: T) => void` | Required | Callback when selection changes |
| `ariaLabel` | `string` | Required | Accessible label for screen readers |
| `variant` | `'default' \| 'tabs' \| 'buttons'` | `'default'` | Visual style variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size of the control |
| `fullWidth` | `boolean` | `false` | Whether buttons stretch to fill container |
| `iconOnly` | `boolean` | `false` | Hide labels, show only icons (requires icons) |

## Option Type

```typescript
interface SegmentedControlOption<T extends string = string> {
  value: T;           // The option value
  label: string;      // Display text (used as aria-label when iconOnly)
  icon?: ReactNode;   // Optional icon (FontAwesome, etc.)
  count?: number;     // Optional count badge (e.g., for tabs)
}
```

## Variants

### Default
- Pill-style buttons
- Inset background container
- Best for mode switches (Search/Trending)

### Tabs
- Underlined tab style
- Transparent background
- Best for page sections (Following/Followers)

### Buttons
- Bordered button group
- Tight spacing
- Best for format selection (Physical/Digital, Platform)

## Sizes

- **sm**: Compact buttons (0.5rem padding)
- **md**: Standard buttons (0.75rem padding)
- **lg**: Large buttons (1rem padding)

## Where It's Used

- **Search.tsx**: Mode toggle, view toggle, platform/format selectors
- **Library.tsx**: View toggle (grid/list/compact)
- **Friends.tsx**: Tabs (following/followers), view toggle
- **SharedLibrary.tsx**: View toggle

## Accessibility

- Uses semantic HTML with proper ARIA roles
- Keyboard navigable (Tab to focus, Arrow keys between options)
- Focus indicators for keyboard users
- Screen reader friendly with descriptive labels
- Respects `prefers-reduced-motion`

## Styling

Styles are in `SegmentedControl.css` using CSS custom properties for theming:
- `--control-bg`: Background color
- `--control-active-bg`: Active button background
- `--control-hover-bg`: Hover state background
- Automatic dark mode support

## Migration from Old Patterns

**Before:**
```tsx
<div className="mode-toggle" role="tablist">
  <button
    role="tab"
    aria-selected={mode === 'search'}
    className={`mode-btn ${mode === 'search' ? 'active' : ''}`}
    onClick={() => setMode('search')}
  >
    Search
  </button>
  <button
    role="tab"
    aria-selected={mode === 'trending'}
    className={`mode-btn ${mode === 'trending' ? 'active' : ''}`}
    onClick={() => setMode('trending')}
  >
    Trending
  </button>
</div>
```

**After:**
```tsx
<SegmentedControl
  options={[
    { value: 'search', label: 'Search' },
    { value: 'trending', label: 'Trending' }
  ]}
  value={mode}
  onChange={setMode}
  ariaLabel="Search mode"
/>
```

Much cleaner and consistent! 🎉
