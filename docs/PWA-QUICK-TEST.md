# PWA Quick Test Checklist

## 🚀 Quick Start

The dev server is already running at http://localhost:5173/

## ✅ Immediate Tests You Can Run

### 1. Service Worker Registration (30 seconds)
1. Open http://localhost:5173/ in Chrome
2. Open DevTools (F12) → **Application** tab → **Service Workers**
3. ✅ Should see: "Status: activated and running"
4. ✅ URL: http://localhost:5173/sw.js

### 2. Manifest Check (30 seconds)
1. In DevTools → **Application** tab → **Manifest**
2. ✅ Verify fields:
   - Name: "My Switch Library"
   - Shortcuts: 3 items (Add Game, My Library, Search)
   - Icons: 3 entries (including maskable)
   - Categories: games, utilities, entertainment

### 3. Offline Mode (1 minute)
1. In DevTools → **Application** → **Service Workers**
2. Check ☑️ **Offline** checkbox
3. 🔶 Orange banner should appear: "You're offline..."
4. Navigate to different pages → all should load
5. Uncheck **Offline**
6. Banner should change or disappear

### 4. Network Status Banner (30 seconds)
1. With Offline checked → banner says "You're offline. Your library..."
2. Uncheck Offline → banner briefly shows "Back online" then fades

### 5. Update Prompt Test (2 minutes)
**Method A: Easy Test**
1. Make a small change (e.g., in `src/pages/Home.tsx`, change some text)
2. Save the file
3. Wait 10-15 seconds
4. 🔴 Red banner should appear at bottom: "New version available!"
5. Click **"Later"** → banner dismisses
6. Click **"Update Now"** → page reloads

**Method B: Production Test**
```bash
# In a new terminal
npm run build
npm run preview
```
- Make a change in code
- Rebuild: `npm run build`
- Return to browser tab
- Wait ~10 seconds → update banner appears

## 📱 Install Test (Chrome Desktop - 1 minute)

1. Look in Chrome address bar for ⊕ install icon (right side)
2. Click it → "Install My Switch Library?" dialog appears
3. Click **Install**
4. App opens in standalone window (no browser chrome)
5. Check:
   - ✅ Window has app name in title bar
   - ✅ No address bar or browser tabs
   - ✅ App appears in Applications folder (macOS) or Start Menu (Windows)

## 📱 Install Test (Mobile - Chrome/Edge)

### Android
1. Open http://YOUR_IP:5173 on phone (or deployed URL)
2. Tap ⋮ menu → **"Install app"** or **"Add to Home Screen"**
3. App appears on home screen
4. Long-press icon → shortcuts appear (Add Game, Library, Search)

### iOS (Limited PWA Support)
1. Open in Safari (not Chrome!)
2. Tap Share button → **"Add to Home Screen"**
3. App appears on home screen (but no shortcuts)

## 🔍 Lighthouse PWA Audit (2 minutes)

```bash
# If testing production build
npm run build
npm run preview
```

1. Open http://localhost:4173 in Chrome
2. DevTools → **Lighthouse** tab
3. Check ☑️ **Progressive Web App** (uncheck others for speed)
4. Click **"Analyze page load"**
5. 🎯 **Target Score: 100/100**

## 🐛 Expected Warnings (Safe to Ignore)

### Build Warnings
- ⚠️ "Some chunks are larger than 500 kB" → Normal for this app size
- ⚠️ "dynamically imported by... statically imported" → Performance optimization, safe

### Console Messages
- `[PWA] Service Worker registered: http://localhost:5173/sw.js` → ✅ Good!
- Workbox messages about caching → ✅ Normal

## 🎯 Success Criteria

If you can verify these 5 things, the PWA is working correctly:

1. ✅ Service worker shows "activated and running" in DevTools
2. ✅ Manifest fields all populated correctly
3. ✅ Offline mode works (pages load with network disabled)
4. ✅ Network status banner appears when toggling offline
5. ✅ App is installable (install icon appears in Chrome)

## 📝 Notes

- **Dev Mode:** Service worker is enabled in development (usually disabled by default)
- **HTTPS:** PWA requires HTTPS in production (GitHub Pages provides this)
- **Updates:** In dev mode, updates happen on file save via hot reload
- **Caching:** Service worker caches are separate from localStorage cache (they work together)

## 🔗 Next Steps

After testing locally:
1. Commit and push to GitHub
2. GitHub Actions will auto-deploy to GitHub Pages
3. Test on deployed URL: https://YOUR_USERNAME.github.io/switch-library/
4. Share install link with friends!

## 📚 Full Documentation

- **Comprehensive Guide:** [PWA-GUIDE.md](PWA-GUIDE.md)
- **Implementation Details:** [PWA-IMPLEMENTATION-SUMMARY.md](PWA-IMPLEMENTATION-SUMMARY.md)
- **Architecture:** [README.md](README.md)

---

**Happy Testing! 🎮**
