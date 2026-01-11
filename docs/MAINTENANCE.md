# Database Maintenance Guide

This document describes routine maintenance tasks for the My Switch Library database.

## Migration: Add Follow-Back Request Support

If you have an existing `friend_lists` table, run this migration to add support for the follow-back request feature:

```sql
-- ============================================
-- MIGRATION: Add Follow-Back Request Columns
-- ============================================
-- Run this in the Supabase SQL Editor

-- Step 1: Add new columns
ALTER TABLE public.friend_lists 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted' 
CHECK (status IN ('accepted'));

ALTER TABLE public.friend_lists 
ADD COLUMN IF NOT EXISTS follow_back_requested boolean DEFAULT false;

ALTER TABLE public.friend_lists 
ADD COLUMN IF NOT EXISTS requested_at timestamp with time zone;

-- Step 2: Create index for follow_back_requested lookups
CREATE INDEX IF NOT EXISTS friend_lists_follow_back_requested_idx 
ON public.friend_lists(follow_back_requested) 
WHERE follow_back_requested = true;

-- Step 3: Create the cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_follow_requests()
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.friend_lists
  SET 
    follow_back_requested = false,
    requested_at = null
  WHERE follow_back_requested = true
  AND requested_at < now() - interval '30 days';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Verify the migration
SELECT 
  'Total follows' as metric, count(*) as value FROM friend_lists
UNION ALL
SELECT 
  'Columns added', count(*) FROM information_schema.columns 
  WHERE table_name = 'friend_lists' AND column_name IN ('status', 'follow_back_requested', 'requested_at');
```

### What This Migration Does

- Adds `status` column (always 'accepted' for the follow model)
- Adds `follow_back_requested` boolean for tracking requests
- Adds `requested_at` timestamp for request expiration
- Creates index for efficient follow-back request queries
- Creates cleanup function for expired requests

**Existing friend entries** automatically become "follows" - no data changes needed!

## Follow-Back Request Cleanup

Follow-back requests older than 30 days are automatically cleared (the follow relationship remains, just the request flag is removed).

### Manual Cleanup Procedure

Run this SQL command in the [Supabase SQL Editor](https://supabase.com/dashboard):

```sql
SELECT cleanup_expired_follow_requests();
```

This function will:
- Clear the `follow_back_requested` flag on entries older than 30 days
- Keep the follow relationship intact
- Return the number of updated records

### Recommended Schedule

Run the cleanup function **monthly** to keep the database clean. Suggested schedule:

| Task | Frequency | SQL Command |
|------|-----------|-------------|
| Follow-back request cleanup | Monthly (1st of month) | `SELECT cleanup_expired_follow_requests();` |

### Example Output

```sql
-- Running cleanup
SELECT cleanup_expired_follow_requests();

-- Result: Returns the count of updated records
-- cleanup_expired_follow_requests
-- -------------------------------
--                              42
```

## Future Automation (Optional)

For automated cleanup, you can enable the `pg_cron` extension in Supabase and schedule the cleanup:

```sql
-- Enable pg_cron extension (requires Supabase Pro plan)
-- create extension if not exists pg_cron;

-- Schedule monthly cleanup on the 1st at midnight UTC
-- select cron.schedule(
--   'monthly-follow-request-cleanup',
--   '0 0 1 * *',
--   'SELECT cleanup_expired_follow_requests();'
-- );
```

> **Note**: The `pg_cron` extension requires a Supabase Pro plan. For free tier projects, use manual cleanup.

## Troubleshooting

### No records updated when expected

Check if there are actually expired requests:

```sql
SELECT count(*) 
FROM friend_lists 
WHERE follow_back_requested = true
AND requested_at < now() - interval '30 days';
```

### View pending follow-back requests

```sql
-- All pending follow-back requests
SELECT fl.*, sp.user_id as target_user_id
FROM friend_lists fl
JOIN share_profiles sp ON sp.share_id = fl.friend_share_id
WHERE fl.follow_back_requested = true
ORDER BY fl.requested_at DESC;

-- Expired requests (candidates for cleanup)
SELECT * 
FROM friend_lists 
WHERE follow_back_requested = true
AND requested_at < now() - interval '30 days';
```

### Check follow statistics

```sql
SELECT 
  follow_back_requested,
  count(*) as count,
  min(requested_at) as oldest_request,
  max(requested_at) as newest_request
FROM friend_lists
GROUP BY follow_back_requested;
```
