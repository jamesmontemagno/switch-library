# Admin Dashboard

This document describes the admin dashboard feature that allows a designated admin user to view usage statistics and application insights.

## Overview

The admin dashboard provides comprehensive statistics about the Switch Library application, including:

- **User Statistics**: Total users, recent registrations
- **Game Statistics**: Total games, games by platform, games by format
- **Community Statistics**: Active sharers, total follows
- **API Statistics**: API search usage count
- **Popular Content**: Top games by collection count

## Configuration

### Setting the Admin User

Admin access is controlled by the `is_admin` field in the user's profile stored in the Supabase database. This provides better security than environment variables.

**To grant admin access to a user:**

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor** → **profiles**
3. Find the user you want to make an admin
4. Set the `is_admin` field to `true` for that user

**Using SQL:**
```sql
UPDATE public.profiles 
SET is_admin = true 
WHERE id = 'user-uuid-here';
```

Replace `'user-uuid-here'` with the actual UUID of the user from the `auth.users` table.

## Finding Your User ID

To find your user ID:

1. Sign in to your Switch Library account
2. Open your browser's Developer Console (F12)
3. Run this command:
   ```javascript
   JSON.parse(localStorage.getItem('switch-library-auth')).id
   ```
4. Copy the UUID

Alternatively, in Supabase dashboard:
1. Go to your Supabase project → **Authentication** → **Users**
2. Find your user and copy the UUID

## Access Control

The admin dashboard is protected by the `AdminRoute` component, which:

1. Requires the user to be authenticated
2. Checks if the user's `is_admin` field is set to `true` in their profile
3. Redirects non-admin users to the home page
4. Only shows the admin link in navigation to admin users

## Navigation

When logged in as the admin user, you'll see:

- **Header Navigation**: An "Admin" link with a chart icon appears between "Following" and "Share"
- **Bottom Navigation (Mobile)**: An "Admin" link appears in the bottom navigation bar
- **URL**: Access directly at `/admin`

## Dashboard Features

### Overview Cards

The dashboard displays key metrics in card format:

- **Total Users**: Number of registered users
- **Total Games**: Number of games across all collections
- **Active Sharers**: Users who have enabled library sharing
- **Total Follows**: Number of follow relationships
- **API Searches**: Total API search requests made

### Detailed Statistics

#### Games by Platform

Shows the distribution of games across platforms:
- Nintendo Switch
- Nintendo Switch 2

Displays count and percentage for each platform.

#### Games by Format

Shows the distribution of physical vs. digital games:
- Physical
- Digital

Displays count and percentage for each format.

#### Top Games by Collection Count

Lists the top 10 most collected games across all users, showing:
- Rank
- Game title
- Number of collections

This helps identify the most popular games in the community.

#### Recent User Registrations

Shows the last 10 user registrations with:
- Display name
- Registration date

Useful for tracking user growth and recent activity.

## Technical Implementation

### Components

- **AdminDashboard.tsx**: Main dashboard component
- **AdminDashboard.css**: Styling for the dashboard
- **AdminRoute.tsx**: Route protection component
- **useIsAdmin.ts**: Hook to check admin status

### Database Functions

The `getAdminStatistics()` function in `src/services/database.ts` queries Supabase for all statistics:

```typescript
export interface AdminStatistics {
  totalUsers: number;
  totalGames: number;
  gamesByPlatform: { platform: string; count: number }[];
  gamesByFormat: { format: string; count: number }[];
  activeSharers: number;
  totalFollows: number;
  apiUsageCount: number;
  recentUsers: Array<{ displayName: string; createdAt: string }>;
  topGames: Array<{ title: string; count: number }>;
}
```

**Note**: The admin dashboard only works in Supabase mode. In localStorage/demo mode, it will display an error message.

### Security Considerations

1. **Database-Level Protection**: Admin status is stored in the database `profiles` table with the `is_admin` boolean field
2. **Server-Side Protection**: Row Level Security (RLS) policies in Supabase protect access to data - only authenticated users can query statistics
3. **No Environment Variables**: Unlike environment variables, database-stored admin flags cannot be accidentally exposed in client-side code
4. **Rate Limiting**: Consider implementing rate limiting on statistics queries to prevent abuse
5. **PII Protection**: The dashboard intentionally does not display personally identifiable information like email addresses

### Database Schema

The `profiles` table includes the `is_admin` field:

```sql
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  github_id bigint,
  login text,
  display_name text,
  avatar_url text,
  is_admin boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Migration from Environment Variables

If you previously used `VITE_ADMIN_USER_ID`, you can migrate by:

1. Running the migration SQL:
   ```sql
   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false NOT NULL;
   UPDATE public.profiles SET is_admin = true WHERE id = 'your-previous-admin-uuid';
   ```

2. Removing `VITE_ADMIN_USER_ID` from your `.env` file and deployment configuration

## Limitations

- Only works in Supabase mode (not available in localStorage/demo mode)
- Shows aggregate data only; individual user data is not accessible
- Statistics are calculated in real-time, which may be slow with large datasets
- Consider caching strategies for large-scale deployments

## Future Enhancements

Potential improvements for the admin dashboard:

1. **Time-Based Analytics**: Track user growth over time, games added per day/week/month
2. **Export Functionality**: Export statistics to CSV or JSON
3. **Advanced Filtering**: Filter statistics by date range or other criteria
4. **User Activity Metrics**: Average games per user, most active users
5. **Platform Analytics**: Detailed breakdown of game genres, release years
6. **Caching**: Cache statistics for improved performance
7. **Refresh Button**: Manual refresh of statistics without page reload
8. **Charts and Graphs**: Visual representation of data using charts
9. **Alerting**: Notifications for unusual activity or milestones

## Troubleshooting

### "Admin dashboard only works with Supabase mode" Error

This error appears when:
- Supabase is not configured (no `VITE_SUPABASE_URL` or `VITE_SUPABASE_KEY`)
- The app is running in demo/localStorage mode

**Solution**: Configure Supabase environment variables.

### Cannot Access Admin Dashboard

If you can't see the admin link or access the dashboard:
- Verify the `is_admin` field is set to `true` in your user's profile in the Supabase database
- Check that you're logged in with the correct account
- Run this SQL query in Supabase to verify:
  ```sql
  SELECT id, login, display_name, is_admin FROM profiles WHERE id = 'your-user-id';
  ```
- Clear browser cache and reload the page
- Check browser console for any authentication errors

### Statistics Not Loading

If the dashboard loads but shows no statistics:
- Check browser console for errors
- Verify Supabase connection
- Ensure the database has data to display
- Check Supabase logs for query errors

## Privacy and Data Protection

The admin dashboard follows these privacy principles:

- **Aggregate Data Only**: Shows counts and summaries, not individual user details
- **No PII Display**: Does not display email addresses or other sensitive information
- **Display Names Only**: Shows only public display names from user registrations
- **Anonymous Trending**: Game additions are anonymous (no user tracking)

## Support

For issues or questions about the admin dashboard:

1. Check the application logs for errors
2. Verify environment configuration
3. Review Supabase query logs
4. Consult the main README.md for general setup issues
