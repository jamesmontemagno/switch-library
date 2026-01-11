# Building My Switch Library: A Deep Dive into Modern Web Architecture with GitHub Copilot

So I built a thing. A Nintendo Switch game library tracker. And I used GitHub Copilot every step of the way - not just the VS Code extension, but the whole ecosystem: cloud agents, planning prompts, Model Context Protocol (MCP) servers, custom instructions, and more. Let me walk you through what I built and how AI-powered development has completely changed how I approach building apps.

## What is My Switch Library?

Look, we've all been there. You're at a game store, see a great deal on a Switch game, and think "Do I already own this?" You pull out your phone, scroll through photos of your game shelf, and... still not sure. That's the problem I set out to solve.

My Switch Library is a web app that lets you track your Nintendo Switch (and the upcoming Switch 2) game collection. Search for games, add them manually, track physical and digital copies, manage your wishlist, and share your collection with friends. It works online with cloud sync, or offline in demo mode. Simple as that.

**Key Features:**
- 🎮 Track physical and digital games across both Switch platforms
- 🔍 Search powered by TheGamesDB with rich metadata and cover art
- ✍️ Manual entry for those obscure indie titles
- 📊 Multiple view modes (grid, list, compact)
- 🔗 Share your collection and compare with friends
- � Twitter-like follow/follower system with follow-back requests
- �💾 Dual-mode operation: full Supabase cloud sync OR localStorage fallback
- 🔐 GitHub OAuth authentication (or email/password, or demo mode)

You can check it out live at [https://jamesmontemagno.github.io/switch-library/](https://jamesmontemagno.github.io/switch-library/) or explore the code at [https://github.com/jamesmontemagno/switch-library](https://github.com/jamesmontemagno/switch-library).

## The Architecture: Hybrid, Resilient, and Smart

### The Stack

Let me break down what I chose and why:

**Frontend:**
- **React 19** with **TypeScript** - Type safety is non-negotiable for me these days
- **Vite 7** - Build times measured in milliseconds, not minutes
- **React Router 6** - Client-side routing that just works
- **CSS with dark mode** - No heavy frameworks, just clean, performant styles

**Backend:**
- **Azure Functions** (.NET 10/C#) - Serverless, pay-per-use, scales automatically
- Acts as a CORS proxy and intelligent caching layer
- Three-tier caching strategy (more on this in a bit)

**Database:**
- **Supabase** (PostgreSQL) with Row Level Security
- Real-time sync, built-in auth, generous free tier
- **OR** localStorage fallback - the app works without any backend!

**External APIs:**
- **TheGamesDB** - Rich game metadata, cover art, release dates
- Strict rate limits (50 searches/month) handled with aggressive caching

### The "Dual-Mode" Pattern: Why Not Both?

Here's where it gets interesting. The entire app is built with a dual-mode operation pattern. Every single data operation supports both Supabase and localStorage:

```typescript
// This pattern is everywhere (see src/services/database.ts)
if (isSupabaseConfigured()) {
  return await loadGamesFromSupabase(userId);
}
return loadGamesFromLocalStorage(userId);
```

Why did I do this? A few reasons:

1. **Resilience** - App works offline, during backend maintenance, or if Supabase has issues
2. **Demo mode** - Anyone can try it instantly without creating an account
3. **Development velocity** - I can develop the entire frontend without any backend running
4. **Future-proofing** - Easy to swap storage backends or add more options

The `isSupabaseConfigured()` check runs at runtime. No hardcoded assumptions. Both paths stay in sync because I use them both constantly.

### The Three-Tier Caching Strategy

TheGamesDB has strict rate limits - 50 searches per month on the free tier. That's about 1.5 searches per day. Not great if you're actively building your library. So I built a three-tier caching system:

**Tier 1: Frontend Cache (localStorage)**
- 7-30 day TTL depending on data type
- Instant responses for cached data
- Survives page refreshes

**Tier 2: Backend Proxy (Azure Functions)**
- CORS handling (frontend can't directly call TheGamesDB)
- Adds API key server-side (security!)
- Background caching (fire-and-forget)

**Tier 3: Blob Storage Cache**
- Persistent cache in Azure Blob Storage
- Lookup data cached for 30 days
- Game data cached indefinitely
- Preserves API quota like it's gold

Here's the clever bit: When you search for "Zelda", the proxy returns results immediately but ALSO caches every game in the results to blob storage in the background:

```csharp
// From TheGamesDbProxy.cs
_ = CacheSearchResultsInBackgroundAsync(jsonDocument.RootElement);
```

That underscore discard (`_`) means "fire and forget" - don't wait for caching to complete. User gets instant results, future requests hit the cache.

### Authentication: GitHub OAuth, Email, or Just Try It

Three authentication modes, all handled gracefully:

1. **GitHub OAuth** (via Supabase) - One-click sign in with your GitHub account
2. **Email/Password** (via Supabase) - Classic auth for those who prefer it
3. **Demo Mode** - No sign-in required, uses localStorage

The `AuthContext` handles this with a reducer pattern (not useState - more predictable state management). The `mapSupabaseUser()` function handles both GitHub OAuth metadata and email user metadata seamlessly.

### Database Schema: RLS is Your Friend

The Supabase schema (`supabase/schema.sql`) uses Row Level Security (RLS) policies extensively. Every table has policies that ensure users only see their own data. The beauty of RLS is that it's enforced at the database level - no way around it, even if your application logic has bugs.

One exception: Share profiles. When `share_profiles.enabled = true`, there's a separate policy that allows public read access. But it respects privacy settings:

```typescript
export interface ShareProfile {
  showDisplayName: boolean;  // Default true
  showAvatar: boolean;        // Default true
  enabled: boolean;           // Master switch
}
```

### Deployment: Hybrid GitHub Pages + Azure Functions

Here's my deployment strategy:

**Frontend:** GitHub Actions → GitHub Pages
- Free hosting
- Automatic deploys on push to main
- Secrets for environment variables
- Base path routing for GitHub Pages (`/switch-library/`)

**Backend:** Azure Functions (manual deployment)
- `func azure functionapp publish switchlibrary-api`
- CORS configured to allow GitHub Pages domain
- Application Settings for API keys and storage
- Serverless pricing (pay only for what you use)

The split deployment works beautifully. Frontend is static files (cheap/free), backend is serverless functions (scales to zero). Total monthly cost? A few cents for Azure Functions, zero for GitHub Pages.

## How GitHub Copilot Built This

Alright, here's the real story. I used GitHub Copilot in ways most developers haven't explored yet. Let me show you how AI-powered development has evolved beyond just autocomplete.

### 1. GitHub Copilot in VS Code: The Foundation

This is the Copilot everyone knows. Autocomplete on steroids. But I use it differently than most:

**Inline suggestions** - I write comments describing what I want, then let Copilot generate the implementation:

```typescript
// Create a function that loads games from Supabase, maps snake_case to camelCase,
// handles errors gracefully, and returns empty array on failure
```

Copilot generates the entire function. I review, tweak, and move on. But the real power is in the next level...

**Chat-driven development** - I open Copilot Chat (Cmd+I or Ctrl+I) and have a conversation:

> "Create a React component for adding friends with share URL/ID extraction, profile fetching, avatar display with fallback, nickname input with 50 char limit, and duplicate checking"

Copilot generates `AddFriendModal.tsx`, following patterns from existing modals in the codebase. It's not perfect, but it's 80% of the way there in seconds.

### 2. Copilot Edits: Multi-File Refactoring

This feature is a game-changer. Instead of asking Copilot to generate code I then copy-paste, Copilot Edits can modify multiple files simultaneously:

> "Add a friends list feature: update schema.sql, create database functions in database.ts, add Friends page, update routing, add navigation link"

Copilot Edits shows me a plan, then makes changes across 6+ files. I review diffs, approve or reject each change. It understands the existing patterns and maintains consistency.

### 3. GitHub Copilot Cloud Agent: Planning at Scale

Here's where it gets wild. The cloud agent (accessed via `@cloud` in VS Code or GitHub.com) has access to the entire repository and can reason about large-scale changes.

I used it to create the friends list feature (see `.github/prompts/plan-friendsList.prompt.md`). I described what I wanted at a high level:

> "I want a friends list where users can save shared library profiles for quick access. One-way follows via share IDs. Full search, sort, and comparison features."

The cloud agent generated a detailed, step-by-step plan:
1. Database schema changes with exact column definitions
2. RLS policies for security
3. Service layer functions (both Supabase and localStorage!)
4. React components with specific prop types
5. Routing updates
6. UI integration points

This plan became my roadmap. Each step references specific files and existing patterns. It's like having a senior architect review your design before you write a single line of code.

### 4. Custom Instructions: Teaching Copilot Your Patterns

This is the secret sauce. I created custom instruction files in `.github/instructions/`:

**`.github/copilot-instructions.md`** - My architectural guide:
- Explains the dual-mode pattern
- Documents the three-tier caching strategy
- Describes authentication flow
- Lists common gotchas
- Shows where to find key files

Every time Copilot generates code, it reads these instructions first. The result? Code that follows my patterns without me explaining it every time.

**Example instructions:**
- `reactjs.instructions.md` - React-specific patterns and conventions
- `a11y.instructions.md` - Accessibility requirements (WCAG 2.2 compliance)
- `update-docs-on-code-change.instructions.md` - Automatic documentation updates

Copilot reads these files and generates code that's already following my standards.

### 5. Custom Agents: Specialized AI Helpers

I set up custom agents for specialized tasks (see `.github/agents/`):

**`github-actions-expert.agent.md`** - CI/CD specialist:
- Focuses on secure workflows
- Action pinning at specific versions
- OIDC authentication patterns
- Least-privilege permissions
- Concurrency control

When I need to update my GitHub Actions workflows, I ask this agent. It knows security best practices I'd otherwise have to Google.

### 6. Model Context Protocol (MCP): Connecting to External Systems

MCP is Copilot's way of connecting to external tools and data sources. I use MCP servers for:

**GitHub MCP Server** - Repository operations:
- Create issues with proper templates
- Search code across the repo
- Read files and commits
- Manage PRs and labels

**Custom Skills** - Task-specific automation:
- `github-issues` skill - Creates well-formatted issues
- `web-design-reviewer` skill - Visual inspection and design feedback

When I say "create a bug issue for the login crash", the GitHub Issues skill:
1. Reads the issue templates from `references/templates.md`
2. Structures the issue body properly
3. Adds appropriate labels
4. Creates the issue via GitHub API

All from a single natural language request.

### The Workflow: How It All Comes Together

Here's my typical development flow:

1. **Planning** - Describe feature to cloud agent, get detailed plan
2. **Implementation** - Use Copilot in VS Code with inline suggestions and chat
3. **Refactoring** - Use Copilot Edits for multi-file changes
4. **Testing** - Ask Copilot to generate test cases (following existing patterns)
5. **Documentation** - Auto-update docs using custom instructions
6. **Code Review** - Cloud agent reviews changes, suggests improvements
7. **Issues** - File follow-up work items using GitHub Issues skill

The key insight: Each Copilot feature has its sweet spot. Cloud agent for planning, VS Code Copilot for implementation, Edits for refactoring, MCP for external integrations.

## Architecture Decisions I'm Happy About

### TypeScript Everywhere

Types catch bugs before runtime. Period. The dual-mode pattern would be impossible to maintain without TypeScript. When I change an interface in `types/index.ts`, TypeScript tells me every place that needs updating.

### Vite for Build Speed

Vite's dev server starts in under a second. Hot module replacement is instant. Build times for production are measured in seconds. Coming from Create React App, this is night and day.

### Supabase for "Backend-as-a-Service"

I didn't write a single line of backend authentication code. Supabase handles:
- User signup/login
- GitHub OAuth
- Email confirmation
- Password reset
- Session management
- Row Level Security

And I get a PostgreSQL database with a beautiful web UI. The Supabase SQL editor is where I run migrations. No complex backend deployment.

### Azure Functions for "Just the Proxy Parts"

I only needed a backend for one thing: proxying TheGamesDB API requests (CORS + API key security). Azure Functions is perfect for this:
- Pay per request (basically free for my usage)
- Scales automatically
- Simple deployment with `func` CLI
- Built-in monitoring

No server to manage, no containers to configure, no Kubernetes nightmares.

### The Dual-Mode Pattern (Again, Because It's Important)

Implementing both Supabase and localStorage paths might seem like extra work. But it:
- Forces clean service layer abstractions
- Makes testing easier (no mocking required)
- Enables instant demo mode
- Provides resilience

And honestly? Copilot wrote most of the localStorage implementations. Once I showed it the Supabase version, it generated the localStorage equivalent in seconds.

## Gotchas and Lessons Learned

### 1. Base Path Routing for GitHub Pages

GitHub Pages serves your site at `username.github.io/repo-name/`. You need to configure this everywhere:

```typescript
// vite.config.ts
base: process.env.VITE_BASE_PATH || '/',
```

Then set `VITE_BASE_PATH='/switch-library/'` in your environment variables. All routes must respect this. Forgot it in one place? Broken navigation. Copilot helped me track down every instance.

### 2. TheGamesDB Rate Limits Are Real

50 searches per month goes fast. The three-tier caching strategy was born from necessity. The first version had no caching - I burned through my monthly allowance in a day of testing.

Pro tip: Add a usage allowance indicator in the UI so users know where they stand. I show it in the footer (see `ApiAllowanceFooter.tsx`).

### 3. Supabase Client Proxy Pattern

The `supabase` export isn't the raw Supabase client - it's a proxy that returns mock chainable queries when Supabase isn't configured:

```typescript
export const supabase = {
  from: (table: string) => {
    if (!supabaseClient) {
      return { select: () => createMockChain([], true) };
    }
    return supabaseClient.from(table);
  }
};
```

This prevents null reference errors in demo mode. The same code works in both modes because the API is identical.

### 4. GitHub Actions Secrets for Environment Variables

Your `.env` file doesn't exist in GitHub Actions. Set secrets in repository settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`
- `VITE_API_BASE_URL`

Then reference them in your workflow:

```yaml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
```

I forgot one initially. The build succeeded but the deployed app was broken. Always test after changing secrets.

## Performance Characteristics

Let's talk numbers:

**Build time:** ~15 seconds (TypeScript compilation + Vite build)
**Dev server startup:** <1 second
**Initial page load:** ~500ms (already optimized with code splitting)
**Game search:** <100ms (cached), ~2s (fresh API call)
**Adding a game:** <200ms (Supabase), instant (localStorage)

The app is snappy. No heavy frameworks, aggressive caching, code splitting for routes. The entire production bundle is under 200KB gzipped.

## The Social Layer: Twitter-Style Follows

One of the most interesting features I built is the social system. Instead of traditional "friend requests" that require approval, I implemented a Twitter/X-style follow model.

### How It Works

**Following is instant** - When you visit someone's shared library, click "Follow" and boom, you're following them. No waiting for approval, no pending requests. Just instant connection.

**Three-tab interface:**
1. **Following** - People you follow (with "Follows you" badges if mutual)
2. **Followers** - People who follow you
3. **Requests** - Follow-back requests (when someone you follow asks you to follow them back)

**Follow-back requests** - This is the clever bit. If someone follows you but you haven't followed them back, they can send a "follow-back request". You can accept (follow them back) or ignore it. If you ignore or don't respond within 30 days, the request flag is cleared but they still follow you.

### The Database Design

The schema is elegantly simple:

```sql
create table public.friend_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  friend_share_id uuid references share_profiles(share_id),
  nickname text check (length(nickname) <= 50),
  status text default 'accepted' check (status in ('accepted')),
  follow_back_requested boolean default false,
  requested_at timestamp with time zone,
  added_at timestamp with time zone default now(),
  unique(user_id, friend_share_id)
);
```

Key points:
- **status** is always 'accepted' (following is instant)
- **follow_back_requested** tracks optional requests
- **requested_at** enables automatic 30-day expiration
- **nickname** lets you label people however you want

### Privacy Controls

Users have granular control:
- **Share toggle** - Enable/disable library sharing entirely
- **Accept follow-back requests** - Allow/block follow-back requests (doesn't affect initial follows)

Even when follow-back requests are disabled, people can still follow you. The toggle only controls whether they can request you to follow them back.

### Automatic Cleanup

A scheduled function clears follow-back requests older than 30 days:

```sql
CREATE FUNCTION cleanup_expired_follow_requests()
RETURNS integer AS $$
BEGIN
  UPDATE friend_lists
  SET follow_back_requested = false, requested_at = null
  WHERE follow_back_requested = true
  AND requested_at < now() - interval '30 days';
  
  RETURN ROW_COUNT;
END;
$$ LANGUAGE plpgsql;
```

This keeps the database clean without breaking follow relationships. The person still follows you, just no nagging request.

### Why This Model?

Traditional friend requests create friction. You find someone's cool library, send a request, wait for approval, maybe they never check... frustrating.

The Twitter model removes friction:
- **Instant gratification** - Follow someone, see their library in your Following tab immediately
- **No rejection anxiety** - Nobody has to "accept" or "reject" you
- **Mutual follows emerge naturally** - If both people find each other interesting, they both follow
- **Follow-back requests are optional** - Only use them if you want someone to follow you back

And the entire thing works in both Supabase mode and localStorage mode. The dual-mode pattern strikes again.

## What's Next?

A few features I'm planning:

1. **Barcode scanning** - Use device camera to scan game barcodes
2. **Advanced comparison** - See games in common, unique to each collection, mutual follows who own specific games
3. **Collection stats** - Charts, graphs, spending analysis
4. **Import/Export** - CSV export, bulk import from other trackers
5. **Activity feed** - See what games your follows are adding/completing

And I'll build all of these with Copilot. The architecture is solid, the patterns are established, and the custom instructions ensure consistency.

## Try It Yourself

The app is live at [jamesmontemagno.github.io/switch-library](https://jamesmontemagno.github.io/switch-library/). Try demo mode - no account required. Add some games, explore the UI, see if it's useful.

The code is open source: [github.com/jamesmontemagno/switch-library](https://github.com/jamesmontemagno/switch-library). Fork it, modify it, learn from it. The custom instructions and prompts are all there. See how I use Copilot at scale.

## Final Thoughts

Building this app showed me how much AI-powered development has matured. It's not about replacing developers - it's about moving faster, maintaining consistency, and focusing on the hard problems.

GitHub Copilot (the full suite - VS Code, cloud agents, MCP, instructions) is my pair programming partner who:
- Never gets tired
- Remembers every pattern in my codebase
- Suggests solutions I wouldn't have thought of
- Handles boilerplate so I can focus on features

The dual-mode architecture, three-tier caching, and TypeScript type safety are all decisions I made. Copilot helped me implement them consistently across dozens of files.

That's the future: AI handles the "how", developers focus on the "what" and "why".

Now go build something. And let Copilot help.

---

*Have questions about the architecture or how I used GitHub Copilot? Find me on GitHub at [@jamesmontemagno](https://github.com/jamesmontemagno) or check out the repo issues. I'm always happy to discuss technical architecture and AI-powered development workflows.*
