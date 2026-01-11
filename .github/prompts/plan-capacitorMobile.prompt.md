# Capacitor Mobile App Conversion

Convert the Switch Library PWA to native iOS and Android apps using Capacitor. This plan assumes the PWA conversion has already been completed.

## Prerequisites

- ✅ PWA conversion completed (service worker, manifest)
- ✅ App works offline with localStorage
- ✅ Build process generates static assets to `dist/`

## Why Capacitor vs React Native

**Capacitor Advantages:**
- Minimal code changes (wraps existing React app)
- Reuse all existing components, routing, styling
- localStorage works out of the box
- Supabase client works as-is
- Deploy web and mobile from same codebase

**React Native Would Require:**
- Rewrite all CSS to StyleSheet API
- Replace react-router-dom with React Navigation
- Replace localStorage with AsyncStorage
- Significant refactoring effort

## Implementation Steps

### 1. Install Capacitor Dependencies

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/browser  # For OAuth
npm install @capacitor/app      # For deep links
```

### 2. Initialize Capacitor Project

```bash
npx cap init
```

**Configuration:**
- App name: "Switch Library"
- App ID: `com.switchlibrary.app` (or custom domain-based ID)
- Web asset directory: `dist`

**Generates:** `capacitor.config.ts`

### 3. Update vite.config.ts for Capacitor Builds

**Problem:** Capacitor uses `capacitor://localhost` protocol, which requires empty base path.

**Solution:** Make base path conditional:

```typescript
export default defineConfig(({ mode }) => ({
  base: mode === 'capacitor' ? '' : (process.env.VITE_BASE_PATH || '/'),
  // ... rest of config
}));
```

**Build commands:**
- Web: `npm run build` (uses VITE_BASE_PATH)
- Capacitor: `npm run build:mobile` or `vite build --mode capacitor`

### 4. Switch to HashRouter for Capacitor Compatibility

**Location:** `src/App.tsx`

**Change:** Replace `BrowserRouter` with `HashRouter`

**Why:** History API doesn't work reliably on `capacitor://` protocol. HashRouter uses URL fragments (`/#/library`) which work on all platforms.

**Impact:** URLs change from `/library` to `/#/library` (acceptable tradeoff for native app support)

**Alternative:** Use conditional routing (detect Capacitor, switch router), but adds complexity.

### 5. Add Platform Detection Utility

**Location:** `src/utils/platform.ts` (new file)

```typescript
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isWeb = !isNative;
```

Use throughout the app to conditionally enable native-specific features.

### 6. Implement Capacitor OAuth Flow

**Location:** `src/contexts/AuthContext.tsx`

**Current Flow (Web):**
1. User clicks "Sign in with GitHub"
2. Supabase redirects to GitHub OAuth
3. GitHub redirects back to app with auth code
4. Supabase exchanges code for session

**Problem:** Step 3 doesn't work—GitHub can't redirect to `capacitor://localhost`

**Solution:** Use in-app browser + deep links

**Implementation:**
1. Detect native platform: `Capacitor.isNativePlatform()`
2. Use `@capacitor/browser` to open OAuth URL
3. Listen for deep link callback via `App.addListener('appUrlOpen')`
4. Handle `switchlibrary://auth/callback?code=...` URL
5. Exchange code for session with Supabase

**Code Pattern:**
```typescript
if (Capacitor.isNativePlatform()) {
  // Get OAuth URL from Supabase
  const { data } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: 'switchlibrary://auth/callback',
      skipBrowserRedirect: true, // Don't auto-redirect
    },
  });
  
  // Open in-app browser
  await Browser.open({ url: data.url });
  
  // Deep link handler (registered in useEffect)
  // App.addListener('appUrlOpen', handleDeepLink);
} else {
  // Existing web OAuth flow
}
```

### 7. Configure Deep Linking in Native Projects

#### iOS (Xcode)

**File:** `ios/App/App/Info.plist`

Add URL scheme:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>switchlibrary</string>
    </array>
  </dict>
</array>
```

#### Android (Android Studio)

**File:** `android/app/src/main/AndroidManifest.xml`

Add intent filter to main activity:
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="switchlibrary" />
</intent-filter>
```

### 8. Update Supabase Dashboard Configuration

**Location:** Supabase Dashboard → Authentication → URL Configuration

Add to "Redirect URLs":
- `switchlibrary://auth/callback`

**Why:** Supabase validates redirect URLs for security. Native app deep link must be explicitly allowed.

### 9. Add Native Platforms

```bash
npx cap add ios
npx cap add android
```

**Generates:**
- `ios/` directory with Xcode project
- `android/` directory with Gradle project

### 10. Configure Capacitor Config

**Location:** `capacitor.config.ts`

**Key settings:**
- `webDir: 'dist'` - Where Capacitor syncs from
- `bundledWebRuntime: false` - Use system WebView (smaller app size)
- iOS/Android specific configs (splash screen, status bar, etc.)

**Example:**
```typescript
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.switchlibrary.app',
  appName: 'Switch Library',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https', // Use https:// instead of capacitor://
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;
```

### 11. Build and Sync Workflow

**Standard workflow:**
```bash
# 1. Build web assets for Capacitor (empty base path)
npm run build:mobile

# 2. Sync to native projects
npx cap sync

# 3. Open in native IDE
npx cap open ios     # Opens Xcode
npx cap open android # Opens Android Studio

# 4. Build/run from native IDE
```

**Dev workflow for live reload:**
```bash
# 1. Run Vite dev server
npm run dev

# 2. In capacitor.config.ts, add:
server: {
  url: 'http://localhost:5173',
  cleartext: true, // Allow HTTP on Android
},

# 3. Run app in simulator (points to dev server)
npx cap run ios
npx cap run android
```

### 12. App Store Preparation

#### iOS
- **App Icons:** Required sizes in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- **Launch Screen:** Configure in Xcode
- **Privacy strings:** `Info.plist` entries for camera, location (if using plugins)
- **Provisioning:** Apple Developer account, certificates, profiles

#### Android
- **App Icons:** Multiple densities in `android/app/src/main/res/mipmap-*/`
- **Adaptive Icons:** `mipmap-anydpi-v26/` with foreground/background
- **Splash Screen:** `res/drawable/splash.png`
- **Signing:** Generate keystore, configure in `android/app/build.gradle`

### 13. Test Native Features

**Testing checklist:**
- Install on physical device (iOS/Android)
- Test OAuth flow end-to-end (GitHub redirect → deep link → login)
- Test email/password auth (should work unchanged)
- Test offline mode with airplane mode
- Test app state preservation (background → foreground)
- Test on both iOS and Android
- Verify localStorage persistence across app restarts
- Test TheGamesDB API calls with native network

## Expected Outcomes

- ✅ Native iOS app (installable via App Store)
- ✅ Native Android app (installable via Google Play)
- ✅ Same codebase as web app (no UI rewrite)
- ✅ OAuth works via in-app browser + deep links
- ✅ Email/password auth works unchanged
- ✅ All offline features work identically
- ✅ localStorage persists across app launches
- ✅ Service worker features work (though limited on iOS)

## Potential Issues & Solutions

| Issue | Solution |
|-------|----------|
| **OAuth callback timing** | Add loading state while waiting for deep link |
| **CORS from native** | Ensure Azure Functions allows `capacitor://localhost` or use `androidScheme: 'https'` |
| **Service worker on iOS** | Limited support; core app works, but updates may not be as smooth |
| **API base URL** | Set `VITE_API_BASE_URL` to full Azure Functions URL for production builds |
| **Large app size** | Optimize images, enable ProGuard (Android), use `bundledWebRuntime: false` |

## Notes

- OAuth is the most complex part due to redirect handling
- Email/password auth requires no native changes
- Consider making OAuth optional on mobile, emphasizing email auth
- HashRouter changes URLs but is simplest solution for Capacitor
- Capacitor plugins can add native features later (camera, push notifications, etc.)
- Apps can be published to both stores from same codebase
