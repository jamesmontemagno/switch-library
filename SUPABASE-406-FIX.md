# Fix for Supabase 406 (Not Acceptable) Errors

## Problem
The application was experiencing `406 (Not Acceptable)` errors when making Supabase API calls, specifically for queries to:
- `share_profiles` table
- `profiles` table  
- `friend_lists` table

## Root Cause
The errors were caused by using `.single()` on Supabase queries that could legitimately return 0 rows:

```typescript
// ❌ BEFORE - Causes 406 error when no row exists
const { data, error } = await supabase
  .from('share_profiles')
  .select('*')
  .eq('user_id', userId)
  .single();  // Expects exactly 1 row, errors with 0 rows
```

According to PostgREST behavior:
- `.single()` expects exactly 1 row
- When 0 rows are returned, PostgREST returns a 406 error with message: *"Results contain 0 rows, application/vnd.pgrst.object+json requires 1 row"*

## Solution
Replace `.single()` with `.maybeSingle()` for SELECT queries that may return 0 rows:

```typescript
// ✅ AFTER - Gracefully handles 0 or 1 row
const { data, error } = await supabase
  .from('share_profiles')
  .select('*')
  .eq('user_id', userId)
  .maybeSingle();  // Returns null when 0 rows, no error
```

## Changes Made

### Functions Updated
The following functions were updated to use `.maybeSingle()`:

1. **`getSharedProfileByShareId()`** - Looking up shared profile by share ID
2. **`getSharedUserProfile()`** - Getting user profile for shared library view
3. **`getUserProfile()`** - Getting user profile info
4. **`isFollowing()`** - Checking if following a user
5. **`isFollowingShareId()`** - Helper to check if following a share ID
6. **`getShareProfileByUserId()`** - Getting share profile by user ID

### Functions NOT Changed
These functions correctly use `.single()` because they're INSERT/UPDATE operations that always return exactly 1 row:

- `saveGameToSupabase()` - UPSERT operation
- `enableSharing()` - UPDATE/INSERT operations
- `regenerateShareId()` - INSERT operation
- `updateSharePrivacy()` - UPDATE operation
- `followUser()` - INSERT operation

## When to Use Each

### Use `.single()`
- INSERT operations (always returns 1 row)
- UPDATE operations (always returns 1 row when successful)
- UPSERT operations (always returns 1 row)
- When you expect exactly 1 row and want an error if not found

### Use `.maybeSingle()`
- SELECT queries where the row might not exist yet
- Checking existence of optional records
- Looking up profiles or settings that may not be created yet
- Any query where "not found" is a valid result

## Testing
To verify the fix:

1. **Share Profile Creation Flow**
   - Create a new user
   - Try to view their share settings (should not error when no profile exists)
   - Enable sharing
   - Verify share profile is created

2. **Following/Unfollowing**
   - Check if following a user you haven't followed yet (should return false, not error)
   - Follow a user
   - Check again (should return true)
   - Unfollow
   - Check again (should return false, not error)

3. **Viewing Shared Libraries**
   - Access a shared library URL with valid share ID
   - Access a shared library URL with invalid share ID (should show not found, not error)

4. **Profile Queries**
   - Query profile for a user who just signed up (should handle gracefully)
   - Query profile for established user (should return data)

## References
- [Supabase/PostgREST `.single()` vs `.maybeSingle()` discussion](https://github.com/orgs/supabase/discussions/2284)
- [Supabase HTTP Status Codes Documentation](https://supabase.com/docs/guides/troubleshooting/http-status-codes)
- [PostgREST 406 Error Details](https://postgrest.org/en/stable/references/errors.html)
