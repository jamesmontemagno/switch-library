# Database Maintenance Guide

This document describes routine maintenance tasks for the My Switch Library database.

## Database Schema Overview

The My Switch Library database uses these main tables:
- **profiles** - User profile information (display name, avatar, etc.)
- **games** - User game collections
- **share_profiles** - User sharing settings and share IDs
- **friend_lists** - Following/follower relationships (instant follow model)
- **api_usage** - API usage tracking for rate limiting
- **game_additions** - Anonymous game addition tracking for trending feature

## Follow System (Instant Follow Model)

The app uses an **instant follow model** similar to Twitter:
- When you follow someone, you're added to their followers list immediately
- No approval required
- No pending requests
- Users can set nicknames for people they follow

### Friend Lists Table Schema

```sql
create table if not exists public.friend_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  friend_share_id uuid references public.share_profiles(share_id) on delete cascade not null,
  nickname text not null check (length(nickname) <= 50),
  status text not null default 'accepted' check (status in ('accepted')),
  added_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_share_id)
);
```

Note: The `status` column always has value `'accepted'` as follows are instant. This column exists for potential future features but is not currently used for pending states.

## Trending Games (Anonymous Tracking)

The `game_additions` table tracks when games are added to collections for the trending feature:
- Completely anonymous (no user_id)
- No Row Level Security (public read/write)
- Tracks `thegamesdb_id` and `added_at` timestamp

### Manual Data Pruning (Optional)

To keep the trending data fresh, you can periodically remove old entries:

```sql
-- Delete game additions older than 90 days
DELETE FROM public.game_additions 
WHERE added_at < now() - interval '90 days';
```

**Recommended Schedule**: Run quarterly (every 3 months)

## API Usage Cleanup

The `api_usage` table tracks search queries for rate limiting (50 searches/month per user).

### Cleanup Old Usage Data

```sql
-- Delete API usage records older than 12 months
DELETE FROM public.api_usage
WHERE timestamp < now() - interval '12 months';
```

**Recommended Schedule**: Run annually or when the table grows large

## Maintenance Schedule

| Task | Frequency | SQL Command | Purpose |
|------|-----------|-------------|---------|
| Game additions cleanup | Quarterly | `DELETE FROM game_additions WHERE added_at < now() - interval '90 days';` | Keep trending data fresh |
| API usage cleanup | Annually | `DELETE FROM api_usage WHERE timestamp < now() - interval '12 months';` | Prevent table bloat |

## Monitoring Queries

### Check Database Statistics

```sql
-- Count records in each table
SELECT 'profiles' as table_name, count(*) as records FROM profiles
UNION ALL
SELECT 'games', count(*) FROM games
UNION ALL
SELECT 'share_profiles', count(*) FROM share_profiles
UNION ALL
SELECT 'friend_lists', count(*) FROM friend_lists
UNION ALL
SELECT 'api_usage', count(*) FROM api_usage
UNION ALL
SELECT 'game_additions', count(*) FROM game_additions;
```

### Check Follow Statistics

```sql
-- Most followed users (users with most followers)
SELECT 
  sp.user_id,
  p.display_name,
  count(fl.id) as follower_count
FROM share_profiles sp
LEFT JOIN friend_lists fl ON fl.friend_share_id = sp.share_id
LEFT JOIN profiles p ON p.id = sp.user_id
WHERE sp.enabled = true
GROUP BY sp.user_id, p.display_name
ORDER BY follower_count DESC
LIMIT 10;
```

### Check Trending Games Activity

```sql
-- Most added games in the last 7 days
SELECT 
  thegamesdb_id,
  count(*) as addition_count,
  max(added_at) as last_added
FROM game_additions
WHERE added_at > now() - interval '7 days'
GROUP BY thegamesdb_id
ORDER BY addition_count DESC
LIMIT 10;
```

### Check API Usage

```sql
-- Users approaching or exceeding monthly limit
WITH monthly_usage AS (
  SELECT 
    user_id,
    count(*) as search_count,
    max(timestamp) as last_search
  FROM api_usage
  WHERE timestamp > date_trunc('month', now())
  GROUP BY user_id
)
SELECT 
  mu.user_id,
  p.display_name,
  mu.search_count,
  mu.last_search
FROM monthly_usage mu
LEFT JOIN profiles p ON p.id = mu.user_id
WHERE mu.search_count >= 40  -- Approaching 50 limit
ORDER BY mu.search_count DESC;
```

## Troubleshooting

### Orphaned Share Profiles

Check for share profiles without associated users:

```sql
SELECT sp.* 
FROM share_profiles sp
LEFT JOIN auth.users u ON u.id = sp.user_id
WHERE u.id IS NULL;
```

### Duplicate Follows

The `unique(user_id, friend_share_id)` constraint prevents duplicates, but you can verify:

```sql
SELECT user_id, friend_share_id, count(*)
FROM friend_lists
GROUP BY user_id, friend_share_id
HAVING count(*) > 1;
```

### Games Without Owners

Check for games referencing deleted users:

```sql
SELECT g.* 
FROM games g
LEFT JOIN auth.users u ON u.id = g.user_id
WHERE u.id IS NULL;
```

> Note: This should not happen due to `ON DELETE CASCADE` in foreign keys, but good to verify.

## Backup Recommendations

1. **Enable Point-in-Time Recovery (PITR)** in Supabase dashboard
2. **Regular backups** - Supabase Pro includes daily backups
3. **Test restore procedures** periodically
4. **Export critical data** for disaster recovery:
   ```sql
   -- Example: Export all user games
   COPY (SELECT * FROM games) TO STDOUT WITH CSV HEADER;
   ```
