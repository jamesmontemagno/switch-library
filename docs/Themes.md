# Theme System

Switch Library includes multiple themes to customize your experience. Each theme is designed to evoke a specific Nintendo aesthetic while maintaining excellent readability and accessibility.

## Available Themes

### Light Theme
The default light theme with clean whites and Nintendo Red accents.
- **Background**: Clean white (#ffffff)
- **Primary Color**: Nintendo Red (#e60012)
- **Best for**: Bright environments, daytime use

### Dark Theme
A modern dark theme that's easy on the eyes.
- **Background**: Dark gray (#1a1a1a)
- **Primary Color**: Nintendo Red (#e60012)
- **Best for**: Low-light environments, nighttime use

### System Theme
Automatically matches your operating system's light/dark mode preference.

### NES Theme 🎮
Inspired by the iconic Nintendo Entertainment System (1983). Features the characteristic cool gray plastic look of the original console.

![NES Console Reference](https://upload.wikimedia.org/wikipedia/commons/8/82/NES-Console-Set.jpg)

**Design Elements:**
- **Background**: Cool blue-gray tones (#c8c8cc) matching NES console plastic
- **Primary Color**: Bold NES Red (#e40521) - the true Nintendo Red
- **Accent**: Black and red stripes reminiscent of the console's controller ports
- **Header**: Gray gradient with bold red/black striped top bar
- **Buttons**: Chunky 3D style with pressed effect (like NES controller buttons)
- **Tags**: Blue for physical (NES cartridge-inspired), red for digital

**Color Palette:**
```css
--bg-primary: #c8c8cc;      /* Cool gray plastic */
--bg-secondary: #aeaeb4;    /* Darker gray */
--primary: #e40521;          /* NES Red */
--border-color: #707078;    /* Dark accent gray */
--tag-physical-bg: #6060c0; /* Blue cartridge */
--tag-digital-bg: #e40521;  /* NES Red */
```

**Best for**: Retro enthusiasts, fans of 80s gaming aesthetics

---

### Famicom Theme 🇯🇵
Inspired by the Japanese Family Computer (1983). Features warm cream colors and gold accents that defined the Famicom's premium look.

![Famicom Console Reference](https://upload.wikimedia.org/wikipedia/commons/0/06/Nintendo-Famicom-Console-Set-FL.jpg)

**Design Elements:**
- **Background**: Warm cream/ivory (#faf5ec) like the Famicom shell
- **Primary Color**: Authentic Famicom Red (#ce2029)
- **Accent**: Gold trim (#d4a520) from the controller buttons and accents
- **Header**: Rich red gradient with gold/cream striped top bar
- **Buttons**: Warm style with gold-accented secondary buttons
- **Tags**: Red for physical, gold for digital

**Color Palette:**
```css
--bg-primary: #faf5ec;      /* Warm cream/ivory */
--bg-secondary: #f0e8dc;    /* Cream */
--primary: #ce2029;          /* Famicom Red */
--accent: #d4a520;           /* Gold trim */
--border-color: #d4c4b0;    /* Warm border */
--tag-physical-bg: #ce2029; /* Famicom Red */
--tag-digital-bg: #d4a520;  /* Gold */
```

**Best for**: Japanese gaming culture enthusiasts, those who prefer warmer tones

---

## How to Change Themes

1. Click your **avatar/profile icon** in the header
2. Navigate to **Settings**
3. Find the **Theme** section
4. Select your preferred theme from the options

Your theme preference is saved locally and will persist across sessions.

## Technical Implementation

Themes are implemented using CSS custom properties (variables) on the `:root` element with `data-theme` attribute selectors:

```css
:root[data-theme="nes"] {
  --bg-primary: #c8c8cc;
  --primary: #e40521;
  /* ... */
}

:root[data-theme="famicom"] {
  --bg-primary: #faf5ec;
  --primary: #ce2029;
  /* ... */
}
```

### Theme-Specific Component Styling

Key components have theme-specific overrides:
- **Header** ([Header.css](../src/components/Header.css)) - Themed gradients and stripe patterns
- **Buttons** ([Button.css](../src/components/Button.css)) - 3D pressed effects for retro themes
- **Bottom Navigation** ([BottomNavigation.css](../src/components/BottomNavigation.css)) - Mobile nav styling
- **Footer** ([Layout.css](../src/components/Layout.css)) - Footer background and accents
- **API Allowance** ([ApiAllowanceFooter.css](../src/components/ApiAllowanceFooter.css)) - Status indicator styling

### usePreferences Hook

Theme state is managed by the `usePreferences` hook ([src/hooks/usePreferences.ts](../src/hooks/usePreferences.ts)):

```typescript
type Theme = 'light' | 'dark' | 'nes' | 'famicom' | 'system';

const { theme, setTheme } = usePreferences();
setTheme('nes'); // Changes to NES theme
```

## Accessibility

All themes are designed with accessibility in mind:
- ✅ **WCAG 2.2 AA compliant** contrast ratios for text
- ✅ **Focus indicators** visible in all themes
- ✅ **Color not sole indicator** - icons and text supplement color coding
- ✅ **Keyboard navigation** works identically across themes

## Adding New Themes

To add a new theme:

1. **Add the theme type** to `usePreferences.ts`:
   ```typescript
   type Theme = 'light' | 'dark' | 'nes' | 'famicom' | 'your-theme' | 'system';
   ```

2. **Define CSS variables** in `index.css`:
   ```css
   :root[data-theme="your-theme"] {
     --bg-primary: #yourcolor;
     --primary: #yourcolor;
     /* Define all required variables */
   }
   ```

3. **Add component overrides** as needed for Header, Buttons, etc.

4. **Add to Settings page** dropdown options

5. **Document** the new theme in this file

## Theme Inspiration

The retro themes were designed to authentically capture the look and feel of classic Nintendo hardware:

- **NES (1985 US)**: Industrial gray design, darker and more utilitarian, red/black accent stripes
- **Famicom (1983 Japan)**: White/cream plastic with red and gold, more playful and premium feel

Both consoles are the same hardware, but their different regional designs created distinct aesthetic identities that still resonate with gamers today.
