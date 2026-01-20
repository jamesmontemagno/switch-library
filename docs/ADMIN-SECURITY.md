# Admin Dashboard Security

This document describes the multi-layered security implementation for the admin dashboard.

## Security Architecture

The admin dashboard uses a **defense-in-depth** approach with multiple security layers:

### 1. Database-Level Security (Server-Side) ✅ **Primary Protection**

**Row Level Security (RLS) Policies** in Supabase ensure that even if client-side checks are bypassed, the database will reject unauthorized queries.

#### Admin Check Function

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT account_level = 'admin' 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### RLS Policies

The following policies restrict access to aggregate data:

```sql
-- Profiles: Allow admins to view all profile counts
CREATE POLICY "Admins can view all profile counts"
  ON public.profiles FOR SELECT
  USING (is_admin());

-- Games: Allow admins to view all game statistics
CREATE POLICY "Admins can view all game statistics"
  ON public.games FOR SELECT
  USING (is_admin());

-- Share Profiles: Allow admins to view all share profiles
CREATE POLICY "Admins can view all share profiles"
  ON public.share_profiles FOR SELECT
  USING (is_admin());

-- Friend Lists: Allow admins to view all friend lists
CREATE POLICY "Admins can view all friend lists"
  ON public.friend_lists FOR SELECT
  USING (is_admin());

-- API Usage: Allow admins to view all API usage
CREATE POLICY "Admins can view all API usage"
  ON public.api_usage FOR SELECT
  USING (is_admin());
```

**How it works:**
- User must be authenticated (valid JWT token)
- User's `account_level` in database must be `'admin'`
- If either check fails, Supabase returns empty results
- **Cannot be bypassed** - enforced at database level

### 2. Environment Variable Allowlist (Optional) ✅ **Additional Layer**

For extra security, you can configure a whitelist of allowed admin user IDs via environment variable.

#### Configuration

Add to `.env` file:
```bash
VITE_ADMIN_ALLOWLIST=uuid-1,uuid-2,uuid-3
```

Or for GitHub Actions / Azure:
```bash
VITE_ADMIN_ALLOWLIST=550e8400-e29b-41d4-a716-446655440000,6ba7b810-9dad-11d1-80b4-00c04fd430c8
```

**How it works:**
- User must have `account_level = 'admin'` in database **AND**
- User ID must be in `VITE_ADMIN_ALLOWLIST`
- Both checks must pass
- Leave empty to disable (database-only check)

**Benefits:**
- Additional protection if database is compromised
- Easy to revoke access without database changes
- Can be updated via deployment without schema migration
- Useful for temporary admin access

### 3. Client-Side Route Protection ⚠️ **UI Layer Only**

The `AdminRoute` component redirects non-admin users before rendering the dashboard.

```typescript
if (user.accountLevel !== 'admin') {
  return <Navigate to="/" replace />;
}
```

**Note:** This is **not a security measure** - it only hides the UI. Database RLS policies are the real protection.

## Security Comparison

| Layer | Bypass Risk | Protection Level | When Active |
|-------|-------------|------------------|-------------|
| **Database RLS** | ❌ Cannot bypass | ✅ **Strong** | Always |
| **Allowlist (optional)** | ⚠️ Can be modified in browser | ✅ Moderate | If configured |
| **Client-Side Route** | ✅ Easy to bypass | ❌ Weak (UI only) | Always |

## Recommended Configuration

### For Production Apps

1. ✅ **Enable RLS policies** (run SQL in `schema.sql`)
2. ✅ **Configure allowlist** with specific admin user IDs
3. ✅ Use both database + allowlist for maximum security

```bash
# .env or deployment config
VITE_ADMIN_ALLOWLIST=your-admin-uuid
```

### For Development / Testing

1. ✅ **Enable RLS policies** (always recommended)
2. ⚠️ **Skip allowlist** for easier testing
3. ✅ Grant admin via database only

```sql
UPDATE profiles SET account_level = 'admin' WHERE id = 'dev-user-uuid';
```

## Setting Up Security

### Step 1: Apply RLS Policies (Required)

Run the SQL commands in `supabase/schema.sql` in your Supabase SQL Editor:

```sql
-- The is_admin() function and all RLS policies are included in schema.sql
-- Just run the entire file or copy the "Admin Security" section
```

Verify policies are active:
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('profiles', 'games', 'share_profiles', 'friend_lists', 'api_usage')
ORDER BY tablename, policyname;
```

### Step 2: Grant Admin Access (Required)

```sql
UPDATE public.profiles 
SET account_level = 'admin' 
WHERE id = 'your-user-uuid';
```

### Step 3: Configure Allowlist (Optional)

Add to your `.env` file or deployment configuration:

```bash
VITE_ADMIN_ALLOWLIST=uuid-1,uuid-2,uuid-3
```

For GitHub Actions, add as repository secret:
1. Go to Settings → Secrets and variables → Actions
2. Add `VITE_ADMIN_ALLOWLIST`
3. Value: Comma-separated UUIDs

For Azure Static Web Apps:
1. Go to Configuration → Application settings
2. Add `VITE_ADMIN_ALLOWLIST`
3. Value: Comma-separated UUIDs

## Testing Security

### Test 1: Verify RLS Policies Work

1. Create a user without admin access
2. Try to query statistics directly in browser console:
   ```javascript
   const { data } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
   console.log(data); // Should only return own profile, not all
   ```
3. ✅ Should NOT return all profiles (only own profile)

### Test 2: Verify Admin Access Works

1. Set user to admin: `UPDATE profiles SET account_level = 'admin' WHERE id = 'user-uuid';`
2. Login as that user
3. Navigate to `/admin`
4. ✅ Should see full statistics dashboard

### Test 3: Verify Allowlist Works

1. Set `VITE_ADMIN_ALLOWLIST=different-uuid` (not your user's UUID)
2. Your user has `account_level = 'admin'` in database
3. Try to access `/admin`
4. ✅ Should redirect to home page

### Test 4: Bypass Attempt (Should Fail)

1. Non-admin user
2. Open DevTools, modify `user.accountLevel` to `'admin'`
3. Navigate to `/admin` route
4. ✅ Route renders, but database queries return empty results due to RLS

## Threat Model

### What This Protects Against:

✅ **Unauthorized data access** - RLS policies block queries  
✅ **Database compromise** - Allowlist provides second factor  
✅ **Malicious admins** - Revoke via database or allowlist  
✅ **Client-side bypass** - RLS enforced server-side  

### What This Does NOT Protect Against:

❌ **Supabase admin panel access** - Use Supabase's team permissions  
❌ **SQL injection** - Supabase uses parameterized queries  
❌ **Leaked JWT tokens** - Use short expiration, secure storage  
❌ **Social engineering** - Train users not to share credentials  

## Revoking Admin Access

### Method 1: Database (Immediate)

```sql
UPDATE public.profiles 
SET account_level = 'standard' 
WHERE id = 'user-uuid';
```

Takes effect immediately. User will be denied on next database query.

### Method 2: Allowlist (Requires Redeployment)

Remove UUID from `VITE_ADMIN_ALLOWLIST` and redeploy:

```bash
# Before
VITE_ADMIN_ALLOWLIST=uuid-1,uuid-2,uuid-3

# After
VITE_ADMIN_ALLOWLIST=uuid-1,uuid-3
```

Takes effect after redeployment. Use database method for immediate revocation.

## Monitoring

### Audit Admin Access

Query who has admin access:

```sql
SELECT id, login, display_name, account_level, created_at
FROM public.profiles
WHERE account_level = 'admin'
ORDER BY created_at;
```

### Monitor Admin Queries

Enable Supabase query logging to monitor admin activity:
1. Go to Supabase Dashboard → Settings → API
2. Enable "Log all queries"
3. Review logs in Logs Explorer

## Best Practices

1. ✅ **Always enable RLS policies** - This is your primary security
2. ✅ **Use allowlist in production** - Defense in depth
3. ✅ **Minimize admin accounts** - Only grant to trusted users
4. ✅ **Regular audits** - Review admin users quarterly
5. ✅ **Short JWT expiration** - Configure in Supabase Auth settings
6. ✅ **Monitor access logs** - Check for suspicious activity
7. ✅ **Document changes** - Keep record of who has admin access

## Troubleshooting

### Admin Can't Access Dashboard

**Check database:**
```sql
SELECT id, login, account_level 
FROM profiles 
WHERE id = 'user-uuid';
```

Should show `account_level = 'admin'`.

**Check allowlist:**
```bash
echo $VITE_ADMIN_ALLOWLIST
# Should contain user's UUID
```

**Check RLS policies:**
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'profiles' 
AND policyname = 'Admins can view all profile counts';
```

Should return a row.

### Statistics Return Empty

**Verify user is authenticated:**
```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log(user); // Should be populated
```

**Verify account_level is 'admin':**
```sql
SELECT account_level FROM profiles WHERE id = auth.uid();
```

Should return `'admin'`.

## Summary

The admin dashboard uses **three security layers**:

1. 🛡️ **Database RLS Policies** (Primary) - Server-side enforcement
2. 🔐 **Environment Allowlist** (Optional) - Additional client-side check
3. 🚪 **Route Protection** (UI Only) - Basic UI hiding

For production, enable **both database RLS and allowlist** for maximum security. The combination ensures that even if one layer is compromised, the other provides protection.
