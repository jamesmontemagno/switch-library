# PWA Conversion with Auto-Update

Convert the Switch Library app to a full Progressive Web App with service worker caching and auto-update prompts. The app already has strong offline foundations (localStorage fallback, API caching)—this adds the service worker infrastructure for asset caching and auto-updates.

## Current State

- ✅ Web App Manifest exists with proper PWA fields
- ✅ Icons (192x192, 512x512) and meta tags configured
- ✅ Robust localStorage fallback for all data operations
- ✅ Multi-tier API caching (7-30 day TTLs)
- ❌ No service worker (blocks offline asset caching)
- ❌ No auto-update mechanism
- ❌ No network status detection UI

## Implementation Steps

### 1. Install vite-plugin-pwa

```bash
npm install -D vite-plugin-pwa
```

### 2. Configure PWA Plugin in vite.config.ts

Add the VitePWA plugin with:
- `registerType: 'prompt'` for user-controlled updates
- Workbox precaching for static assets (JS, CSS, HTML, images)
- Runtime caching for TheGamesDB API responses
- Service worker generation

**Configuration Details:**
- Cache static assets with CacheFirst strategy
- Cache TheGamesDB API responses with NetworkFirst strategy (7-day max age)
- Generate service worker in development mode for testing
- Auto-update service worker registration

### 3. Create UpdateAvailableBanner Component

**Location:** `src/components/UpdateAvailableBanner.tsx`

**Features:**
- Uses vite-plugin-pwa's `useRegisterSW` hook
- Listens for `needRefresh` event from service worker
- Displays accessible toast/banner when update is available
- Provides "Update Now" button to trigger `updateServiceWorker()`
- Dismissible "Later" option
- Positioned non-intrusively (bottom of screen)

**Accessibility:**
- `role="status"` for screen reader announcements
- Keyboard navigable buttons
- Clear contrast for visibility
- Focus management when displayed

### 4. Integrate Update Banner into Layout

**Location:** `src/components/Layout.tsx`

Add `<UpdateAvailableBanner />` to the layout component so it appears on all pages when an update is available.

### 5. Enhance Web App Manifest

**Location:** `public/site.webmanifest`

Add missing PWA fields:
- `id`: Unique identifier for PWA identity (e.g., `/switch-library/`)
- `categories`: ["games", "utilities", "entertainment"]
- `shortcuts`: Quick actions for:
  - "Add Game" → `/search` or `/library?action=add`
  - "My Library" → `/library`
  - "Search" → `/search`
- `screenshots`: Array of mobile/desktop screenshots for install prompts
- `orientation`: "any" or "portrait-primary"

### 6. Create Maskable Icon

**Location:** `public/android-chrome-512x512-maskable.png`

- Generate maskable (adaptive) icon variant for Android
- Add to manifest with `purpose: "maskable any"`
- Ensures icon displays properly on all Android home screens

### 7. Add Network Status Indicator

**Location:** `src/components/Layout.tsx` or new `src/contexts/NetworkContext.tsx`

**Features:**
- Track `navigator.onLine` state
- Listen to `online` and `offline` window events
- Display subtle banner when offline (e.g., top of Layout)
- Show "You're offline" message with icon

**Accessibility:**
- `role="status"` or `role="alert"` for offline state
- Clear visual indicator with sufficient contrast
- Informative message about offline capabilities

### 8. Test PWA Installation

**Testing Checklist:**
- Chrome DevTools → Application → Manifest (verify all fields)
- Chrome DevTools → Application → Service Workers (verify registration)
- Chrome DevTools → Lighthouse → PWA audit (aim for 100/100)
- Test "Install app" prompt on mobile and desktop
- Test offline functionality (disable network, navigate app)
- Test update prompt (rebuild app, refresh page, verify banner)
- Test on iOS Safari (note limitations: no background sync)

## Expected Outcomes

- ✅ Service worker caches static assets for offline access
- ✅ TheGamesDB API responses cached in service worker (extends existing localStorage cache)
- ✅ Users see "Update Available" banner when new version is deployed
- ✅ Installable on home screen (Android, Windows, macOS, chromebooks)
- ✅ Network status visible to users
- ✅ Lighthouse PWA score: 100/100
- ⚠️ iOS support limited (works, but no background sync or push notifications)

## Notes

- Existing localStorage caching continues to work alongside service worker cache
- Demo mode remains fully functional offline
- Supabase mode requires initial network connection for auth, then works offline
- GitHub Pages deployment workflow needs no changes (service worker generated at build time)
- Auto-update prompt only shows when user returns to tab with outdated SW
