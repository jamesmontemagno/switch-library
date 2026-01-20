# Summary of 406 Error Fix

## Issue
Users were experiencing `406 (Not Acceptable)` HTTP errors when using the application, specifically when:
- Checking if a user has a share profile
- Looking up user profiles
- Checking if following another user
- Viewing shared libraries

## Error Messages
```
GET https://qtqlkmyezdektgmpxdri.supabase.co/rest/v1/share_profiles?select=*&user_id=eq.f99fd962-fe1c-430c-93ba-963a0827775c 406 (Not Acceptable)
GET https://qtqlkmyezdektgmpxdri.supabase.co/rest/v1/profiles?select=display_name%2Cavatar_url&id=eq.f99fd962-fe1c-430c-93ba-963a0827775c 406 (Not Acceptable)
GET https://qtqlkmyezdektgmpxdri.supabase.co/rest/v1/friend_lists?select=id&user_id=eq.568a6c8d-7a27-4113-87d9-3d85876c3fac&friend_share_id=eq.cd6ff2d7-0d56-4e98-9918-805ab70b758b 406 (Not Acceptable)
```

## Root Cause
The Supabase JavaScript client was using `.single()` on queries that could return 0 rows. PostgREST (Supabase's REST API) returns a 406 error when:
- A query uses `.single()` which expects exactly 1 row
- The actual result contains 0 rows
- Error details: *"Results contain 0 rows, application/vnd.pgrst.object+json requires 1 row"*

## Fix Applied
Changed 6 SELECT queries from `.single()` to `.maybeSingle()`:

1. `getSharedProfileByShareId()` - Line 528
2. `getSharedUserProfile()` - Line 586  
3. `getUserProfile()` - Line 688
4. `isFollowing()` - Line 767
5. `isFollowingShareId()` - Line 991
6. `getShareProfileByUserId()` - Line 1119

## Technical Details

### What's the difference?

**`.single()`**
- Expects exactly 1 row
- Returns 406 error if 0 rows returned
- Returns error if multiple rows returned
- Use for: INSERT, UPDATE, UPSERT operations

**`.maybeSingle()`**
- Expects 0 or 1 row
- Returns `data: null` if 0 rows (no error)
- Returns error if multiple rows returned
- Use for: SELECT queries where record might not exist

### Code Example

```typescript
// ❌ BEFORE - Causes 406 when no share profile exists
const { data, error } = await supabase
  .from('share_profiles')
  .select('*')
  .eq('user_id', userId)
  .single();  // Error when 0 rows

if (error || !data) {
  return null;  // Triggered even on legitimate "not found"
}

// ✅ AFTER - Gracefully handles not found
const { data, error } = await supabase
  .from('share_profiles')
  .select('*')
  .eq('user_id', userId)
  .maybeSingle();  // Returns null when 0 rows, no error

if (error || !data) {
  return null;  // Only triggered on actual errors
}
```

## Impact

### Before Fix
- Users saw 406 errors in console
- Functions checking for records that don't exist yet would fail
- New users might have issues with share profiles, following, etc.
- Legitimate "not found" scenarios were treated as errors

### After Fix
- No more 406 errors for legitimate "not found" scenarios
- Share profile checking works correctly for new users
- Following/follower checks work without errors
- Profile lookups handle missing profiles gracefully

## Verification

### Build Status
✅ TypeScript compilation successful
✅ Vite build successful  
✅ ESLint passed with no errors

### Files Changed
- `src/services/database.ts` - 6 changes (`.single()` → `.maybeSingle()`)
- `SUPABASE-406-FIX.md` - New documentation file
- `package-lock.json` - Dependencies updated

### Testing Recommendations
1. Test new user signup and share profile creation
2. Test following a user for the first time
3. Test viewing a shared library
4. Test profile queries for existing and new users
5. Verify console shows no more 406 errors

## References
- [Supabase .single() vs .maybeSingle() Discussion](https://github.com/orgs/supabase/discussions/2284)
- [PostgREST Error Handling](https://postgrest.org/en/stable/references/errors.html)
- [Supabase Troubleshooting Guide](https://supabase.com/docs/guides/troubleshooting/http-status-codes)

## Related Files
- Full details: `SUPABASE-406-FIX.md`
- Code changes: `src/services/database.ts`
