# Manual Testing Guide for 406 Error Fix

This guide provides step-by-step instructions to manually verify that the 406 error fix is working correctly.

## Prerequisites
- Browser with developer tools (Chrome, Firefox, Edge, Safari)
- Access to a deployed instance of the Switch Library app
- Ability to create test accounts

## Test Scenarios

### Test 1: New User Share Profile Check
**Purpose:** Verify that checking for a non-existent share profile doesn't cause 406 error

**Steps:**
1. Open browser developer tools (F12) → Console tab
2. Create a new user account (or sign in with a fresh account)
3. Navigate to the user menu and click "Share Library" or similar
4. Check the console for errors

**Expected Results:**
- ✅ No 406 errors in console
- ✅ Share settings UI loads successfully
- ✅ Shows "sharing disabled" or similar state
- ❌ Should NOT see: `GET .../share_profiles?...user_id=... 406 (Not Acceptable)`

**Previous Behavior:**
- ❌ Would show 406 error when checking if user has share profile
- ❌ Error: "Results contain 0 rows, application/vnd.pgrst.object+json requires 1 row"

---

### Test 2: Following a User (First Time)
**Purpose:** Verify that checking if following a user works correctly when not yet following

**Steps:**
1. Open browser developer tools → Console tab
2. Sign in with User A
3. Get a share link from User B
4. Navigate to User B's shared library using their share link
5. Observe the "Follow" button state
6. Check console for errors

**Expected Results:**
- ✅ No 406 errors in console
- ✅ "Follow" button appears (not "Following")
- ✅ Can click Follow button successfully
- ❌ Should NOT see: `GET .../friend_lists?...friend_share_id=... 406 (Not Acceptable)`

**Previous Behavior:**
- ❌ Would show 406 error when checking if already following
- ❌ Might incorrectly show "Following" state or error state

---

### Test 3: Profile Lookup for New User
**Purpose:** Verify that looking up a user profile works for newly created users

**Steps:**
1. Open browser developer tools → Console tab
2. Create a brand new user account
3. Navigate to any page that shows user info (Library, Friends, etc.)
4. Check console for errors

**Expected Results:**
- ✅ No 406 errors in console
- ✅ User profile displays correctly (or shows fallback)
- ✅ Avatar and display name render appropriately
- ❌ Should NOT see: `GET .../profiles?...id=... 406 (Not Acceptable)`

**Previous Behavior:**
- ❌ Would show 406 error when profile hasn't loaded yet
- ❌ Profile data might fail to display

---

### Test 4: Viewing Shared Library (Invalid Share ID)
**Purpose:** Verify that accessing a non-existent share ID is handled gracefully

**Steps:**
1. Open browser developer tools → Console tab
2. Navigate to a shared library URL with a fake UUID
   - Example: `/shared/00000000-0000-0000-0000-000000000000`
3. Check console for errors

**Expected Results:**
- ✅ No 406 errors in console
- ✅ Shows "Library not found" or similar message
- ✅ User is not stuck on loading screen
- ❌ Should NOT see: `GET .../share_profiles?...share_id=... 406 (Not Acceptable)`

**Previous Behavior:**
- ❌ Would show 406 error when share profile doesn't exist
- ❌ Might show error page or broken UI

---

### Test 5: Full Workflow Test
**Purpose:** Complete end-to-end test of share and follow features

**Steps:**
1. Open browser developer tools → Console tab, filter to "406" to catch any errors
2. **User A:**
   - Create new account
   - Add some games to library
   - Enable sharing (first time)
   - Copy share link
3. **User B (different browser/incognito):**
   - Create new account or sign in
   - Access User A's share link
   - Follow User A
   - Navigate to Friends page
4. **User A:**
   - Navigate to Friends page
   - Check followers list
5. Check console throughout entire workflow for ANY 406 errors

**Expected Results:**
- ✅ No 406 errors at any point in the workflow
- ✅ Share profile created successfully for User A
- ✅ User B can view shared library
- ✅ User B can follow User A
- ✅ User A sees User B in followers
- ✅ All UI states render correctly

**Previous Behavior:**
- ❌ Multiple 406 errors during this workflow
- ❌ Potential failures at share profile creation
- ❌ Potential failures at follow/unfollow operations

---

## How to Check Console for Errors

### Chrome/Edge
1. Press F12 or Right-click → Inspect
2. Click "Console" tab
3. Optional: Filter by "406" or "Error"
4. Look for red error messages

### Firefox
1. Press F12 or Right-click → Inspect
2. Click "Console" tab
3. Optional: Filter by "Error"
4. Look for red error messages

### Safari
1. Enable Developer menu: Preferences → Advanced → "Show Develop menu"
2. Develop → Show Web Inspector
3. Click "Console" tab
4. Look for red error messages

---

## Success Criteria

The fix is successful if:
- ✅ **Zero 406 errors** appear in console during any test scenario
- ✅ All UI features work as expected
- ✅ Share profiles can be created and viewed
- ✅ Following/unfollowing works correctly
- ✅ Profile data loads correctly for all users
- ✅ "Not found" scenarios are handled gracefully

---

## Reporting Issues

If you encounter any problems:

1. **Take a screenshot** of the console showing any errors
2. **Note the exact steps** that led to the error
3. **Record browser and version** (e.g., Chrome 120, Firefox 121)
4. **Check if error is 406 or different** error code
5. **Report to development team** with all above information

---

## Technical Notes

### What Changed?
- Changed 6 database queries from `.single()` to `.maybeSingle()`
- Affected queries: share profiles, user profiles, and friend list checks
- Now handles "not found" as valid state instead of error

### Why the Fix Works?
- `.single()` requires exactly 1 row, errors on 0 rows
- `.maybeSingle()` allows 0 or 1 row, returns null on 0 rows
- SELECT queries checking for optional records now use `.maybeSingle()`
- INSERT/UPDATE queries still use `.single()` (correct behavior)

---

## Quick Reference: Before vs After

| Scenario | Before (Error) | After (Fixed) |
|----------|---------------|---------------|
| Check share profile (not exists) | 406 Error | Returns null, no error |
| Check if following (not following) | 406 Error | Returns false, no error |
| Lookup profile (new user) | 406 Error | Returns null, no error |
| Invalid share ID | 406 Error | Returns null, shows "not found" |
| Create share profile (first time) | 406 on check, then creates | Checks cleanly, then creates |
