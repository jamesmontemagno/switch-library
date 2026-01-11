# Universal Logger Guide

## Overview

The Switch Library application includes a universal logger service that provides conditional debug logging. Logging is **only enabled for a specific user ID** configured via environment variable, making it safe to deploy to production while still being able to debug issues for specific users.

## Why Use This Logger?

- **Production Safety**: Logs are only shown for specified users, not all users
- **Performance**: No logging overhead when disabled
- **Structured Logging**: Consistent log format with timestamps and context
- **Categorized**: Different log methods for different purposes (auth, database, API, cache, etc.)
- **Colored Output**: Easy-to-read console output with color-coded log levels

## Configuration

### Environment Variable

Set the `VITE_DEBUG_USER_ID` environment variable to enable logging for a specific user:

```env
# .env file
VITE_DEBUG_USER_ID=your-user-id-here
```

### Finding User IDs

You can find user IDs in several ways:

1. **From the browser console** (when logged in):
   ```javascript
   // Check logger state
   console.log(logger.getState());
   ```

2. **From Supabase Dashboard**: Navigate to Authentication → Users and copy the UUID

3. **From demo mode**: The user ID is shown in localStorage under `switch-library-auth`

### GitHub Actions Deployment

To enable logging for a specific user in your deployed app, add the secret to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `VITE_DEBUG_USER_ID`
4. Value: The user ID you want to debug
5. Click **Add secret**

The GitHub Actions workflow will automatically use this secret during build.

## Usage

### Basic Logging

Import the logger in your component or service:

```typescript
import { logger } from '../services/logger';

// Info level - general information
logger.info('User profile loaded', { displayName: user.displayName });

// Debug level - detailed debugging info
logger.debug('Processing filters', { platform, format, sortBy });

// Warning level - non-critical issues
logger.warn('Cache is stale', { cacheAge: ageInMs });

// Error level - critical errors
logger.error('Failed to save game', error, { gameId: game.id });
```

### Specialized Logging Methods

#### Authentication Events

```typescript
logger.auth('User logged in', { userId: user.id, provider: 'github' });
logger.auth('Password reset requested', { email });
```

#### Database Operations

```typescript
logger.database('insert', 'games', { gameId: game.id, title: game.title });
logger.database('update', 'share_profiles', { userId, shareId });
logger.database('delete', 'games', { gameId });
```

#### API Usage Tracking

```typescript
logger.apiUsage('TheGamesDB.searchGames', { 
  query: searchTerm, 
  platformId: PLATFORM_IDS.NINTENDO_SWITCH 
});
logger.apiUsage('Supabase.rpc', { function: 'get_followers' });
```

#### Cache Operations

```typescript
logger.cache('hit', 'game:12345', { gameId: 12345, title: 'Zelda' });
logger.cache('miss', 'search:zelda', { query: 'zelda' });
logger.cache('set', 'game:12345', { ttl: 86400 });
logger.cache('clear', 'all');
```

#### Navigation Events

```typescript
logger.navigation('/library', { from: '/search' });
logger.navigation('/game/12345', { gameId: 12345 });
```

#### Component Lifecycle

```typescript
export function MyComponent() {
  logger.component('MyComponent', 'mount');
  
  useEffect(() => {
    logger.component('MyComponent', 'update', { propsChanged: true });
  }, [props]);
  
  useEffect(() => {
    return () => {
      logger.component('MyComponent', 'unmount');
    };
  }, []);
  
  // ... rest of component
}
```

## Integration in Auth Context

The logger is automatically initialized when a user logs in or out:

```typescript
// In AuthContext.tsx
case 'LOGIN_SUCCESS':
  logger.setUser(action.payload.id);
  logger.auth('User logged in', { userId: action.payload.id });
  // ...

case 'LOGOUT':
  logger.setUser(null);
  logger.auth('User logged out');
  // ...
```

## Log Levels

| Level | Purpose | Color | When to Use |
|-------|---------|-------|-------------|
| `debug` | Detailed debugging information | Gray | Fine-grained state tracking, loop iterations, detailed flow |
| `info` | General informational messages | Blue | Normal app operations, successful actions |
| `warn` | Warning messages for non-critical issues | Orange | Deprecated features, performance warnings, non-blocking errors |
| `error` | Error messages for critical issues | Red | Failed operations, exceptions, critical failures |

## Best Practices

### DO ✅

```typescript
// ✅ Include relevant context
logger.info('Game saved', { 
  gameId: game.id, 
  title: game.title, 
  platform: game.platform 
});

// ✅ Use appropriate log levels
logger.debug('Filter applied', { filterType: 'platform', value: 'Switch' });
logger.error('Database connection failed', error, { retryCount: 3 });

// ✅ Log at key decision points
if (useSupabase) {
  logger.info('Using Supabase mode', { userId });
  return loadGamesFromSupabase(userId);
} else {
  logger.info('Using localStorage mode', { userId });
  return loadGamesFromLocalStorage(userId);
}

// ✅ Log async operation outcomes
const result = await fetchData();
if (result) {
  logger.info('Data fetched successfully', { recordCount: result.length });
} else {
  logger.warn('No data returned from API');
}
```

### DON'T ❌

```typescript
// ❌ Don't log sensitive information
logger.info('User logged in', { 
  password: user.password,  // NEVER LOG PASSWORDS
  apiKey: config.apiKey     // NEVER LOG API KEYS
});

// ❌ Don't log in tight loops without conditions
games.forEach(game => {
  logger.debug('Processing game', { game }); // This creates spam
});

// Instead, summarize:
logger.debug('Processing games', { count: games.length });

// ❌ Don't use console.log directly
console.log('User data', user); // Use logger instead

// ❌ Don't log redundant information
logger.info('Starting to load games');
logger.info('Loading games...');
logger.info('About to load games');
// Just one is enough!
```

## Checking Logger State

You can check the current logger state at any time:

```typescript
const state = logger.getState();
console.log('Logger enabled:', state.enabled);
console.log('Current user:', state.userId);
console.log('Debug user:', state.debugUserId);
```

## Performance Considerations

The logger is designed to have **zero performance impact** when disabled:

- All log methods immediately return if logging is not enabled
- No string concatenation or object serialization occurs
- No function calls are made to console methods

This means you can safely add logging throughout your codebase without worrying about performance in production.

## Troubleshooting

### Logging Not Showing

1. **Check environment variable is set**:
   ```bash
   # Development
   cat .env | grep VITE_DEBUG_USER_ID
   ```

2. **Verify user ID matches**:
   ```typescript
   console.log(logger.getState());
   // Check if userId matches debugUserId
   ```

3. **Ensure you're logged in**: Logging only works when authenticated

4. **Check browser console filters**: Make sure console isn't filtering by log level

### Logs Showing in Production

If you see logs in production that shouldn't be there:

1. Remove or comment out `VITE_DEBUG_USER_ID` from environment
2. Rebuild and redeploy the application
3. Clear browser cache

## Examples in Codebase

See these files for real-world usage examples:

- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) - Authentication logging
- [src/services/database.ts](src/services/database.ts) - Database operation logging
- [src/services/thegamesdb.ts](src/services/thegamesdb.ts) - API and cache logging
- [src/pages/Library.tsx](src/pages/Library.tsx) - Component lifecycle logging

## Future Enhancements

Potential improvements to the logger:

- [ ] Remote logging support (send logs to a service)
- [ ] Log level configuration per category
- [ ] Performance metrics tracking
- [ ] Log export functionality
- [ ] Multiple user ID support (comma-separated)
- [ ] Time-based log expiry
- [ ] Log aggregation and analysis tools

## Security Notes

⚠️ **IMPORTANT**: 

- Never commit `.env` files with real user IDs to version control
- Regularly rotate debug user IDs in production
- Don't log sensitive information (passwords, tokens, API keys, PII)
- Review logs before sharing screen recordings or screenshots
- Use GitHub Secrets for production deployments, not hardcoded values

## Support

For issues or questions about the logger:

1. Check this guide first
2. Review the logger source: [src/services/logger.ts](src/services/logger.ts)
3. Open an issue on GitHub with relevant log output
