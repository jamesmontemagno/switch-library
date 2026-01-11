# PWA Implementation Guide

This document describes the Progressive Web App (PWA) implementation in the Switch Library app.

## Overview

The Switch Library app is now a full Progressive Web App with:
- ✅ Service worker for offline asset caching
- ✅ Auto-update prompts when new versions are available
- ✅ Network status detection and user notifications
- ✅ Installable on mobile and desktop devices
- ✅ Enhanced web app manifest with shortcuts and metadata

## Architecture

### Service Worker Caching Strategy

The app uses Workbox (via vite-plugin-pwa) with a multi-tier caching strategy:

1. **Static Assets (CacheFirst)**
   - All JS, CSS, HTML, images, fonts
   - Cached indefinitely, updated on new deployment
   - Pattern: `**/*.{js,css,html,ico,png,svg,woff,woff2}`

2. **TheGamesDB API (NetworkFirst, 7-day TTL)**
   - API responses from `api.thegamesdb.net`
   - Network-first: tries network, falls back to cache
   - Max 100 entries, 7-day expiration
   - Works alongside existing localStorage cache

3. **Backend API (NetworkFirst, 7-day TTL)**
   - Azure Functions API responses
   - Network-first strategy
   - Max 50 entries, 7-day expiration

4. **TheGamesDB Images (CacheFirst, 30-day TTL)**
   - Game cover images from `cdn.thegamesdb.net`
   - Cache-first: instant loading from cache
   - Max 200 entries, 30-day expiration

### Update Mechanism

The app uses `registerType: 'prompt'` which means:
- Service worker updates in the background
- User is notified via `UpdateAvailableBanner` when update is ready
- User controls when to apply the update (immediate or later)
- Update automatically checks every hour

**Flow:**
1. User opens app (or returns after idle)
2. Service worker checks for updates
3. If new version available, download in background
4. Show banner: "New version available!"
5. User clicks "Update Now" → page reloads with new version
6. User clicks "Later" → banner dismissed, update on next visit

### Network Status Detection

The `NetworkStatus` component:
- Monitors `navigator.onLine` state
- Listens to `online` and `offline` window events
- Shows banner at top of screen when offline
- Informs users that "Your library and cached games are still available"
- Auto-dismisses when back online

## Components

### UpdateAvailableBanner

**Location:** `src/components/UpdateAvailableBanner.tsx`

**Features:**
- Uses `useRegisterSW` hook from vite-plugin-pwa
- Positioned at bottom of screen (fixed)
- Accessible with `role="status"` and `aria-live="polite"`
- Two actions: "Update Now" (reloads app) and "Later" (dismisses)
- Auto-checks for updates every hour

**Styling:**
- Red Nintendo-themed gradient background
- Responsive design (stacks on mobile)
- Smooth slide-up animation
- Focus indicators for keyboard navigation

### NetworkStatus

**Location:** `src/components/NetworkStatus.tsx`

**Features:**
- Positioned below header (fixed top)
- Shows only when offline
- Uses Font Awesome icons (wifi/wifi-slash)
- Accessible with `role="status"` and `aria-live="polite"`
- Orange gradient for warning/informational state

**Styling:**
- Orange/amber gradient background
- Responsive font sizing
- Smooth slide-down animation
- Complements header design

## Configuration

### vite.config.ts

Key PWA configuration:
```typescript
VitePWA({
  registerType: 'prompt',  // User-controlled updates
  includeAssets: [...],    // Icons and static files
  manifest: {...},         // Embedded manifest config
  workbox: {
    globPatterns: [...],   // Static asset patterns
    runtimeCaching: [...]  // API caching strategies
  },
  devOptions: {
    enabled: true          // Enable in development
  }
})
```

### site.webmanifest

Enhanced with:
- `id`: Unique PWA identifier (`/switch-library/`)
- `categories`: App categories for stores
- `shortcuts`: Quick actions (Add Game, Library, Search)
- `orientation`: Any (portrait/landscape support)
- `maskable` icon purpose for Android adaptive icons

## Testing Checklist

### Chrome/Edge DevTools

1. **Application → Manifest**
   - Verify all fields populated correctly
   - Check icons display properly
   - Confirm shortcuts are listed

2. **Application → Service Workers**
   - Verify service worker is registered
   - Check status: "activated and is running"
   - Test "Update on reload" option
   - Test "Offline" checkbox → app still loads

3. **Lighthouse → Progressive Web App**
   - Run audit (aim for 100/100 score)
   - Review any warnings or suggestions
   - Check "Installable" criteria met

### Manual Testing

#### Installation
- [ ] Desktop Chrome: Address bar shows install icon
- [ ] Mobile Chrome: "Add to Home Screen" prompt appears
- [ ] Desktop Edge: "App available" prompt appears
- [ ] After install: App opens in standalone window (no browser chrome)

#### Offline Functionality
- [ ] With network: App loads and functions normally
- [ ] Disable network (DevTools or airplane mode)
- [ ] Offline banner appears at top
- [ ] Navigate between pages → static assets load from cache
- [ ] Library page displays (from localStorage or Supabase cache)
- [ ] Search page loads (cached cards from localStorage)
- [ ] Re-enable network → "Back online" message briefly appears

#### Update Flow
- [ ] Make a code change, rebuild app
- [ ] Deploy to hosting (GitHub Pages or local preview)
- [ ] Return to open tab (or refresh after 1+ hours)
- [ ] Update banner appears at bottom
- [ ] Click "Later" → banner dismisses
- [ ] Click "Update Now" → page reloads with new version
- [ ] Verify new version is running

#### Shortcuts
- [ ] Install app to home screen
- [ ] Long-press app icon (Android) or right-click (desktop)
- [ ] Verify shortcuts appear: "Add Game", "My Library", "Search"
- [ ] Click shortcut → app opens to correct page

### Browser Compatibility

✅ **Full Support:**
- Chrome/Edge (desktop and mobile)
- Samsung Internet
- Opera

⚠️ **Partial Support:**
- Safari (iOS/macOS): No service worker notifications, no shortcuts
  - Still installable as web app
  - Uses localStorage cache for offline
  - No update prompts (auto-updates on next launch)

❌ **No PWA Support:**
- Firefox (no install prompt, SW works but not installable)

## Deployment Notes

### GitHub Actions

No changes needed to `.github/workflows/deploy.yml`. The service worker is generated at build time:

```bash
npm run build  # Generates dist/ with SW
```

Output includes:
- `dist/sw.js` - Service worker file
- `dist/workbox-*.js` - Workbox runtime
- `dist/manifest.webmanifest` - Injected manifest

### Environment Variables

No new env vars required. Existing vars work as expected:
- `VITE_BASE_PATH` - Respects base path for SW scope
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` - Backend config unchanged
- `VITE_API_BASE_URL` - API proxy config unchanged

### Caching Considerations

**Q: Will service worker cache conflict with localStorage cache?**
A: No. They work together:
- Service worker caches **network responses** (API JSON, images, assets)
- localStorage caches **parsed data** (game entries, user preferences)
- Service worker reduces network requests
- localStorage enables instant UI updates

**Q: How do I invalidate caches?**
A: Deploy a new version. Service worker auto-updates, localStorage respects TTLs.

**Q: What if user has old cached data?**
A: 
- Static assets: Automatic update via service worker
- API cache: Respects 7-day TTL, then re-fetches
- localStorage game cache: Respects 7-30 day TTL per game
- User data (library): Always current (Supabase or localStorage)

## Troubleshooting

### Service Worker Not Registering

**Symptoms:** No SW in DevTools, update banner never appears

**Solutions:**
1. Ensure HTTPS (or localhost) - SW requires secure context
2. Check console for registration errors
3. Verify `vite-plugin-pwa` is in `vite.config.ts`
4. Clear site data and reload

### Update Banner Appears Immediately

**Symptoms:** Banner shows on every page load

**Solutions:**
1. Check if SW update check interval is too aggressive
2. Verify `registerType: 'prompt'` (not `'autoUpdate'`)
3. Clear SW in DevTools and re-register

### Offline Mode Not Working

**Symptoms:** Blank screen or errors when offline

**Solutions:**
1. Check SW is activated (DevTools → Application → SW)
2. Verify `workbox.globPatterns` includes necessary files
3. Test in incognito (cache may be full)
4. Check console for cache errors

### Icons Don't Display on Android

**Symptoms:** White box or default icon on home screen

**Solutions:**
1. Generate proper maskable icon (see next section)
2. Add `purpose: "maskable any"` to manifest icon
3. Ensure icon has "safe area" (center 80% of canvas)

## Next Steps

### Generate Maskable Icon (Optional)

To create a proper maskable icon for Android:

1. Visit [Maskable.app](https://maskable.app/editor)
2. Upload `public/android-chrome-512x512.png`
3. Adjust safe area (ensure logo fits in center circle)
4. Export as `android-chrome-512x512-maskable.png`
5. Update manifest:
   ```json
   {
     "src": "/android-chrome-512x512-maskable.png",
     "sizes": "512x512",
     "type": "image/png",
     "purpose": "maskable"
   }
   ```

### Add Screenshots (Optional)

For better app store listings and install prompts:

1. Take screenshots of key screens (Library, Search, Game Details)
2. Save as 540x720 (portrait) or 720x540 (landscape)
3. Add to `public/screenshots/`
4. Update manifest:
   ```json
   "screenshots": [
     {
       "src": "/screenshots/library.png",
       "sizes": "540x720",
       "type": "image/png",
       "form_factor": "narrow"
     }
   ]
   ```

## Resources

- [PWA Builder](https://www.pwabuilder.com/) - Test and package PWA
- [Maskable.app](https://maskable.app/) - Generate maskable icons
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) - Automated PWA audits
- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Vite PWA Plugin Docs](https://vite-pwa-org.netlify.app/)

