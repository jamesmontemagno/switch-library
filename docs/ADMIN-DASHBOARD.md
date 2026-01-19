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

The admin user is configured via the `VITE_ADMIN_USER_ID` environment variable. This should be set to the UUID of the user in the Supabase `auth.users` table.

**In `.env` file:**
```bash
VITE_ADMIN_USER_ID=your-admin-user-uuid-here
```

**For GitHub Actions:**
Add the `VITE_ADMIN_USER_ID` as a repository secret in Settings → Secrets and variables → Actions.

**For Azure Static Web Apps or other hosting:**
Add the `VITE_ADMIN_USER_ID` to your application settings or environment variables.

## Finding Your User ID

To find your user ID for admin access:

1. Sign in to your Switch Library account
2. Open your browser's Developer Console (F12)
3. Run this command:
   ```javascript
   localStorage.getItem('switch-library-auth')
   ```
4. Copy the `id` field from the JSON output
5. Use this ID as your `VITE_ADMIN_USER_ID`

Alternatively, you can check your Supabase dashboard:
1. Go to your Supabase project → Authentication → Users
2. Find your user and copy the UUID

## Access Control

The admin dashboard is protected by the `AdminRoute` component, which:

1. Requires the user to be authenticated
2. Checks if the user's ID matches the configured `VITE_ADMIN_USER_ID`
3. Redirects non-admin users to the home page
4. Only shows the admin link in navigation to the admin user

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

1. **Client-Side Protection**: The admin check happens on the client side, so determined users could potentially bypass the UI protection
2. **Server-Side Protection**: For production use, consider implementing Row Level Security (RLS) policies in Supabase that restrict access to these aggregate queries
3. **Rate Limiting**: Consider implementing rate limiting on statistics queries to prevent abuse
4. **PII Protection**: The dashboard intentionally does not display personally identifiable information like email addresses

### Supabase RLS Policies (Optional Enhancement)

To add server-side protection, you could create a custom RLS policy or function in Supabase that checks if the requesting user is the admin:

```sql
-- Example: Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Replace with your actual admin user ID
  RETURN user_id = 'your-admin-uuid'::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Then use in policies as needed
```

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
- Verify `VITE_ADMIN_USER_ID` is set correctly
- Ensure the user ID matches your authenticated user's ID exactly (UUIDs are case-sensitive)
- Check that you're logged in
- Restart the development server after changing environment variables
- Clear browser cache and reload

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
