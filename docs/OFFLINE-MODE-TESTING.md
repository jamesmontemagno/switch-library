# Offline Mode Testing Guide

## Overview

This document provides a comprehensive testing guide for the offline mode functionality implemented in the Switch Library PWA. The offline mode allows users to view their cached library and friends data while preventing any data modification when the network is unavailable.

## What Works Offline

### ✅ Cached Data Viewing
- **Library Page**: View all games in your collection (loaded from cache)
- **Friends Page**: View following and followers lists (loaded from cache)
- **Navigation**: Navigate between Library and Friends pages
- **Theme Switching**: Light/dark mode toggle continues to work

### ❌ Actions Disabled Offline
- **Search**: Cannot search for new games
- **Add Games**: Cannot add new games to library
- **Edit Games**: Cannot edit game details
- **Delete Games**: Cannot remove games from library
- **Game Details**: Cannot view detailed game information
- **Friend Management**: Cannot add, edit, or remove friends
- **Library Sharing**: Cannot modify sharing settings
- **Compare Libraries**: Cannot compare with friends' libraries

## Testing Instructions

### Manual Testing

#### 1. Test Offline Detection

**Steps:**
1. Open the app in a browser (Chrome/Edge recommended)
2. Open DevTools (F12)
3. Go to Network tab
4. Enable "Offline" mode checkbox
5. Observe the offline banner appears at the top

**Expected Results:**
- Orange warning banner displays: "You're offline. Your library and friends list are cached and viewable, but adding, editing, or deleting is disabled."

#### 2. Test Library Page Offline

**Steps:**
1. Go online and navigate to Library page
2. Load some games (cache will be populated)
3. Enable offline mode in DevTools
4. Refresh the page
5. Try clicking on:
   - "Add Games" button
   - Edit button on a game card
   - Delete button on a game card
   - Share button
   - A game card to view details

**Expected Results:**
- Cached games display correctly
- All buttons show disabled state with tooltips
- Clicking buttons shows alert: "You are offline. [Action] is not available in offline mode."
- Clicking game card shows: "You are offline. Game details cannot be viewed in offline mode."

#### 3. Test Friends Page Offline

**Steps:**
1. Go online and navigate to Friends page
2. Load friends/followers (cache will be populated)
3. Enable offline mode in DevTools
4. Refresh the page
5. Try clicking on:
   - "Follow User" button
   - "Refresh" button
   - "Share" button
   - "View" on a friend
   - "Edit" on a friend
   - "Unfollow" on a friend

**Expected Results:**
- Cached friends/followers display correctly
- All action buttons show disabled state
- Clicking buttons shows appropriate offline alerts

#### 4. Test Search Page Offline

**Steps:**
1. Navigate to Search page
2. Enable offline mode in DevTools
3. Try to search for a game

**Expected Results:**
- Prominent warning banner displays at top of search page
- Search input is disabled
- Mode toggle (Search/Trending) shows offline alert when clicked
- All search functionality is unavailable

#### 5. Test Settings Page Offline

**Steps:**
1. Navigate to Settings page
2. Enable offline mode in DevTools
3. Try to click "Manage Sharing Settings"

**Expected Results:**
- "Manage Sharing Settings" button is disabled
- Clicking shows: "You are offline. Sharing settings are not available in offline mode."
- Theme switching still works (client-side only)

### Automated Testing Checklist

#### Cache Functionality
- [ ] Games are cached after loading library while online
- [ ] Friends are cached after loading friends page while online
- [ ] Followers are cached after loading friends page while online
- [ ] Cache persists across page refreshes
- [ ] Cache loads correctly when going offline
- [ ] Cache updates when going back online

#### Offline Detection
- [ ] `useOnlineStatus` hook correctly detects online state
- [ ] `useOnlineStatus` hook correctly detects offline state
- [ ] Hook responds to `window.online` event
- [ ] Hook responds to `window.offline` event
- [ ] Network status banner appears when offline
- [ ] Network status banner disappears when back online

#### UI State Management
- [ ] All add/edit/delete buttons disabled when offline
- [ ] Disabled buttons show appropriate tooltips
- [ ] Alert messages are user-friendly and informative
- [ ] Navigation to detail pages blocked when offline
- [ ] Search functionality completely disabled offline
- [ ] Sharing settings disabled offline

#### Data Integrity
- [ ] No data mutations possible when offline
- [ ] Cache data is read-only when offline
- [ ] Going back online re-enables all functionality
- [ ] No data corruption when transitioning online/offline

## Browser Compatibility

### Tested Browsers
- ✅ Chrome 120+
- ✅ Edge 120+
- ✅ Firefox 120+
- ✅ Safari 17+

### Known Issues
- None at this time

## Network Simulation

### Chrome DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Use "Throttling" dropdown
4. Select "Offline" to simulate offline mode
5. Select "Online" to restore connectivity

### Firefox DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox to simulate offline mode
4. Uncheck to restore connectivity

## Implementation Details

### Key Files
- `src/hooks/useOnlineStatus.ts` - Online/offline detection hook
- `src/services/offlineCache.ts` - Data caching utilities
- `src/pages/Library.tsx` - Offline support in library view
- `src/pages/Friends.tsx` - Offline support in friends view
- `src/pages/Search.tsx` - Disabled when offline
- `src/pages/Settings.tsx` - Limited functionality offline
- `src/pages/GameDetails.tsx` - Blocked when offline
- `src/components/NetworkStatus.tsx` - Offline warning banner

### Caching Strategy
- Uses localStorage for caching (simple, reliable, no IndexedDB complexity)
- Cache keys are versioned for future migration
- Separate caches for library, friends, and followers
- Cache includes timestamp for future TTL implementation
- User-specific caching (multiple users can use same device)

### Online Detection
- Uses `navigator.onLine` API
- Listens to `window.online` and `window.offline` events
- Hook updates React state on network changes
- Banner component shows/hides based on online state

## Future Enhancements

### Potential Improvements
1. **Queue Offline Actions**: Store user actions made offline and sync when back online
2. **IndexedDB Migration**: Move from localStorage to IndexedDB for larger datasets
3. **Cache TTL**: Add time-to-live for cached data
4. **Partial Offline**: Allow read-only game details from cached data
5. **Offline Indicators**: Add subtle indicators to UI elements (e.g., "Cached" badges)
6. **Sync Status**: Show last sync time and manual sync button
7. **Service Worker Integration**: Deeper integration with service worker for better offline experience

## Troubleshooting

### Cache Not Loading
**Problem**: Offline mode shows empty lists
**Solution**: Go online first and visit each page to populate cache

### Actions Not Disabled
**Problem**: Buttons still clickable when offline
**Solution**: Hard refresh (Ctrl+Shift+R) to clear old code

### Offline Detection Not Working
**Problem**: Banner doesn't appear when offline
**Solution**: Ensure browser supports `navigator.onLine` API

### Cache Stale Data
**Problem**: Old data showing in offline mode
**Solution**: Clear browser storage and repopulate cache while online

## Testing Coverage

### Unit Tests (Future)
- [ ] Test `useOnlineStatus` hook with mock events
- [ ] Test cache save/load functions
- [ ] Test offline state detection in components

### Integration Tests (Future)
- [ ] Test full offline flow: online → offline → cache load → online
- [ ] Test action prevention when offline
- [ ] Test navigation blocking when offline

### E2E Tests (Future)
- [ ] Simulate full user journey with network toggle
- [ ] Test multiple users with separate caches
- [ ] Test data sync after coming back online
