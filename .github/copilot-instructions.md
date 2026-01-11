# Switch Library - AI Coding Instructions

## Architecture Overview

This is a **hybrid React SPA with dual-mode operation**:
- **Frontend**: React 19 + TypeScript, Vite 7, React Router 6
- **Backend**: Azure Functions (.NET 10 C#) acting as API proxy
- **Database**: Supabase (PostgreSQL) with Row Level Security OR localStorage fallback
- **Key Design**: System operates in two modes automatically based on environment configuration

### Dual-Mode Operation Pattern

**Critical**: All data operations support both Supabase and localStorage:
```typescript
// Pattern used throughout (see src/services/database.ts)
if (useSupabase) {
  return await loadGamesFromSupabase(userId);
}
return loadGamesFromLocalStorage(userId);
```

The `isSupabaseConfigured()` check determines mode at runtime. No hardcoded assumptions - always implement both paths.

## Data Flow Architecture

### TheGamesDB API Integration (3-tier caching strategy)

1. **Frontend Cache** (localStorage, 7-30 day TTL)
2. **Backend Proxy** ([backend-api/TheGamesDbProxy.cs](backend-api/TheGamesDbProxy.cs)) - handles CORS, adds API key server-side
3. **Blob Storage Cache** ([backend-api/GetGameById.cs](backend-api/GetGameById.cs)) - preserves API quota

**Why**: TheGamesDB has strict rate limits (50 searches/month). Always check cache first. Background caching on search results is fire-and-forget to avoid blocking responses.

```csharp
// Search results automatically cache all games in background (TheGamesDbProxy.cs)
_ = CacheSearchResultsInBackgroundAsync(jsonDocument.RootElement);
```

### Database Schema Key Points ([supabase/schema.sql](supabase/schema.sql))

- **RLS Policies**: All tables use Row Level Security - users only see their own data
- **Share Profiles**: Separate policy allows public read when `enabled = true`
- **Automatic Triggers**: `updated_at` and profile creation on auth signup
- **Snake_case DB** ↔ **camelCase TypeScript**: Manual mapping in [database.ts](src/services/database.ts) `mapSupabaseGameToEntry()`

## Development Workflow

### Local Development Setup

```bash
# Terminal 1: Backend (Azure Functions)
cd backend-api
dotnet run  # Runs on http://localhost:7071

# Terminal 2: Frontend (Vite dev server)
npm run dev  # Runs on http://localhost:5173
```

**Critical**: Vite proxy ([vite.config.ts](vite.config.ts)) forwards `/api/*` → `localhost:7071` during development. In production, use `VITE_API_BASE_URL` for Azure Functions endpoint.

### Environment Variables

**Frontend** ([src/services/supabase.ts](src/services/supabase.ts)):
- `VITE_SUPABASE_URL` - Required for Supabase mode
- `VITE_SUPABASE_KEY` - Modern publishable key (sb_publishable_*) preferred, legacy anon key supported
- `VITE_API_BASE_URL` - Backend URL (default: `/api` for proxy)
- `VITE_BASE_PATH` - Base path for routing (e.g., `/switch-library/` for GitHub Pages)

**Backend** ([backend-api/local.settings.json](backend-api/local.settings.json)):
```json
{
  "Values": {
    "TheGamesDB__ApiKey": "required-get-from-thegamesdb-net",
    "ProductionStorage": "blob-connection-string-or-UseDevelopmentStorage=true",
    "BlobStorage__ContainerName": "games-cache"
  }
}
```

## Code Conventions & Patterns

### Authentication Flow ([src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx))

- **3 auth methods**: GitHub OAuth (via Supabase), email/password (Supabase), demo mode (localStorage)
- **Auto-detection**: Checks `isSupabaseConfigured()` at runtime
- **User mapping**: `mapSupabaseUser()` handles both GitHub OAuth and email metadata
- **State management**: Reducer pattern, not useState - maintains consistency

### Component Structure

- **Pages** ([src/pages/](src/pages/)): Top-level routes, handle data fetching
- **Components** ([src/components/](src/components/)): Presentational, receive props
  - **ShareLibraryModal** ([src/components/ShareLibraryModal.tsx](src/components/ShareLibraryModal.tsx)): Reusable modal for managing share library settings
    - Used across Library, Friends, and SharedLibrary pages
    - Handles display name editing, sharing toggle, privacy settings (show name/avatar)
    - Auto-loads user profile and share settings on mount
    - Triggers `onSharingEnabled` callback when sharing is enabled for parent refresh
- **Hooks** ([src/hooks/](src/hooks/)): Reusable logic (useAuth, usePreferences, useSEO)
- **Services** ([src/services/](src/services/)): External API/database interfaces

### Type Safety ([src/types/index.ts](src/types/index.ts))

All domain types defined centrally. Key enums enforced by database CHECK constraints:
```typescript
type Platform = 'Nintendo Switch' | 'Nintendo Switch 2';
type Format = 'Physical' | 'Digital';
type GameStatus = 'Owned' | 'Wishlist' | 'Borrowed' | 'Lent' | 'Sold';
```

**Critical**: These must match database constraints in [schema.sql](supabase/schema.sql). Don't add new values without migration.

### Universal Logger ([src/services/logger.ts](src/services/logger.ts), [LOGGING-GUIDE.md](LOGGING-GUIDE.md))

The app includes a conditional logger that only outputs for specific users in production:
```typescript
import { logger } from './services/logger';

// Automatically initialized on user login/logout via AuthContext
// Only logs when current user ID matches VITE_DEBUG_USER_ID env var

logger.info('Games loaded', { count: games.length });
logger.database('insert', 'games', { gameId, title });
logger.apiUsage('TheGamesDB.searchGames', { query });
logger.cache('hit', 'game:12345');
logger.error('Failed to save', error, { context });
```

**Key Features**:
- Zero performance impact when disabled (immediate return)
- Automatic user tracking via AuthContext integration
- Specialized methods: `auth()`, `database()`, `apiUsage()`, `cache()`, `navigation()`, `component()`
- Colored console output with timestamps and context
- Safe for production - only enabled for `VITE_DEBUG_USER_ID`

**When to use**:
- Add logging to all service functions (database, API calls)
- Log component lifecycle events in complex components
- Track cache hits/misses for performance debugging
- Log authentication state changes
- Record API usage to diagnose rate limiting

**Don't log**: Passwords, API keys, tokens, or PII. See [LOGGING-GUIDE.md](LOGGING-GUIDE.md) for full documentation.

## Backend Patterns (Azure Functions)

### Function Structure

- **Authorization**: `AuthorizationLevel.Anonymous` - relies on CORS, not auth tokens
- **Dependency Injection** ([Program.cs](backend-api/Program.cs)): HttpClientFactory registered for pooling
- **Configuration**: `IConfiguration` auto-binds from `local.settings.json` / Azure App Settings

### Proxy Pattern ([TheGamesDbProxy.cs](backend-api/TheGamesDbProxy.cs))

```csharp
// Route: /api/thegamesdb/{*path}
// Catches: /api/thegamesdb/Games/ByGameName?name=zelda
// Forwards: https://api.thegamesdb.net/v1/Games/ByGameName?name=zelda&apikey=***
```

**Security**: API key NEVER exposed to frontend. Backend adds it server-side.

### Caching Strategy ([GetGameById.cs](backend-api/GetGameById.cs))

1. Check blob storage first (game-{id}.json)
2. If miss, fetch from TheGamesDB API
3. Cache result, return to frontend

**Important**: Lookup data (Genres, Developers, Publishers) cached for 30 days, game data indefinitely.

## Common Gotchas

### 1. Base Path Routing
```typescript
// vite.config.ts
base: process.env.VITE_BASE_PATH || '/',
```
GitHub Pages deployment requires `/switch-library/` base. Local dev uses `/`. All routes must respect this.

### 2. Supabase Client Proxy ([src/services/supabase.ts](src/services/supabase.ts))

The `supabase` export is NOT the raw client - it's a proxy that returns mock chainable queries when unconfigured:
```typescript
// Returns MockPromise that chains without errors
export const supabase = {
  from: (table: string) => {
    if (!supabaseClient) {
      return { select: () => createMockChain([], true) };
    }
    return supabaseClient.from(table);
  }
};
```

**Why**: Prevents null reference errors in demo mode. Code works same way regardless of configuration.

### 3. API Usage Tracking ([src/services/database.ts](src/services/database.ts))

TheGamesDB rate limits are strict. The app tracks searches per month:
- 50 searches/month limit (configurable via `USAGE_LIMIT`)
- Tracked in `api_usage` table (Supabase) or localStorage
- UI shows allowance footer ([ApiAllowanceFooter.tsx](src/components/ApiAllowanceFooter.tsx))

**Cache hits don't count** - always prefer cached results over API calls.

**Handling Allowance Gracefully**:
- Check allowance before expensive operations: `isAllowanceExhausted()` and `isAllowanceLow()` helpers in [thegamesdb.ts](src/services/thegamesdb.ts)
- Show [UsageLimitModal](src/components/UsageLimitModal.tsx) when limits are reached
- Frontend cache (7-30 day TTL) + blob storage cache mean most queries never hit the API
- Encourage users to add games manually if quota is exhausted

### 4. Share Profile Privacy ([src/services/database.ts](src/services/database.ts))

Share IDs expose data via RLS bypass policies. Privacy settings:
```typescript
export interface ShareProfile {
  showDisplayName: boolean;  // Default true
  showAvatar: boolean;        // Default true
  enabled: boolean;           // Master switch
}
```

**Security**: When implementing sharing features, always respect these flags in `getSharedUserProfile()`.

## Testing Checklist

When making changes that affect core functionality:

1. Testing Strategy

**Current State**: No test files exist yet. When implementing tests:

1. **Unit Tests**:
   - Service layer functions ([database.ts](src/services/database.ts), [thegamesdb.ts](src/services/thegamesdb.ts))
   - Mock Supabase client for database tests
   - Mock fetch for API tests
   - Test both Supabase and localStorage code paths

2. **Component Tests**:
   - Key components like [AddGameModal](src/components/AddGameModal.tsx), [EditGameModal](src/components/EditGameModal.tsx)
   - Test with React Testing Library
   - Mock useAuth hook for authenticated state

3. **E2E Tests** (future):
   - Critical user flows: search → add game → view library
   - Test both demo mode and Supabase mode

**Recommended Tools**: Vitest (matches Vite ecosystem), React Testing Library, MSW for API mocking

## CI/CD & Deployment

### GitHub Actions Workflow

The project uses GitHub Actions for automated deployment to GitHub Pages. Key configuration:

1. **Secrets Required** (Repository Settings → Secrets and variables → Actions):
   - `VITE_SUPABASE_URL` - Supabase project URL
   - `VITE_SUPABASE_KEY` - Publishable or anon key
   - `VITE_API_BASE_URL` - Azure Functions URL (e.g., `https://switchlibrary-api.azurewebsites.net/api`)
   - `VITE_BASE_PATH` - Base path for routing (e.g., `/switch-library/`)
   - `VITE_DEBUG_USER_ID` - (Optional) Enable logging for specific user ID

2. **Build Process**:
   ```bash
   npm run build  # TypeScript compilation + Vite build → dist/
   ```

3. **Deployment Trigger**: Push to `main` branch auto-deploys frontend

### Backend Deployment (Manual)

Azure Functions backend deployed separately:
```bash
cd backend-api
func azure functionapp publish <function-app-name>
```

**Required Azure Configuration**:
- Application Settings: `TheGamesDB__ApiKey`, `ProductionStorage`, `BlobStorage__ContainerName`
- CORS: Add GitHub Pages domain (e.g., `https://jamesmontemagno.github.io`)

### Deployment Targets

**Recommended: Hybrid (GitHub Pages + Azure Functions)**
- Frontend: GitHub Actions → GitHub Pages (free hosting)
- Backend: Azure Functions (serverless, pay-per-use)
- Best for personal projects, clear separation of concerns

**Alternative: Azure Static Web Apps**
- Integrated frontend + backend deployment
- More expensive but simpler configurationre Functions)
- Frontend: GitHub Actions → GitHub Pages
- Backend: `func azure functionapp publish switchlibrary-api`
- Configure CORS in Azure Portal to allow GitHub Pages domain

### Alternative: Azure Static Web Apps
- Integrated deployment, but more expensive
- See [README.md](README.md) "Alternative: Integrated Azure Deployment"

## Key Files Reference

| File | Purpose |
|------|---------|
| [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) | Dual-mode auth with GitHub OAuth/email/demo |
| [src/components/ShareLibraryModal.tsx](src/components/ShareLibraryModal.tsx) | Reusable share settings modal across pages |
| [src/services/database.ts](src/services/database.ts) | Supabase ↔ localStorage abstraction layer |
| [src/services/thegamesdb.ts](src/services/thegamesdb.ts) | Frontend API client with multi-tier caching |
| [src/services/logger.ts](src/services/logger.ts) | Universal conditional logger for debugging |
| [backend-api/TheGamesDbProxy.cs](backend-api/TheGamesDbProxy.cs) | CORS proxy + background blob caching |
| [backend-api/GetGameById.cs](backend-api/GetGameById.cs) | Blob-first lookup with API fallback |
| [supabase/schema.sql](supabase/schema.sql) | Database schema with RLS policies |
| [vite.config.ts](vite.config.ts) | Dev proxy configuration |
| [LOGGING-GUIDE.md](LOGGING-GUIDE.md) | Complete logger documentation |

## Quick Command Reference

```bash
# Development
npm run dev              # Start frontend dev server (port 5173)
cd backend-api && dotnet run  # Start backend (port 7071)

# Building
npm run build           # Production build → dist/
cd backend-api && dotnet build  # Backend build

# Linting
npm run lint           # ESLint check

# Azure Functions Deployment
cd backend-api
func azure functionapp publish <function-app-name>

# Database
# Run schema.sql in Supabase SQL Editor (one-time setup)
```

## When Adding New Features

1. **New game fields**: Update [types/index.ts](src/types/index.ts) → [schema.sql](supabase/schema.sql) → [database.ts](src/services/database.ts) mapping functions
2. **New API endpoints**: Add to [backend-api/](backend-api/) as new Function class with HTTP trigger
3. **New routes**: Add to [App.tsx](src/App.tsx) router, create page in [pages/](src/pages/)
4. **New database operations**: Implement both Supabase AND localStorage paths in [database.ts](src/services/database.ts)

Always maintain dual-mode compatibility - the system should work offline with demo data.
