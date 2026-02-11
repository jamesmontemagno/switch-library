# Game Sync Tool - Usage Examples

## Quick Start

1. **Configure the tool** by editing `appsettings.json`:
   ```json
   {
     "TheGamesDB": {
       "ApiKey": "your-api-key-here"
     },
     "BlobStorage": {
       "ConnectionString": "your-connection-string"
     }
   }
   ```

2. **Run in interactive mode** (recommended for first-time use):
   ```bash
   dotnet run
   ```

## Interactive Mode Example

When you run without arguments, you'll see:

```
===========================================
Switch Library - Game Sync Tool
===========================================

Running in INTERACTIVE mode

===========================================
Main Menu:
===========================================
1. Full Sync - Sync all games and lookup data
2. Sync Games Only - Sync games without lookup data
3. Sync Switch 2 Games Only - Sync only Nintendo Switch 2 games
4. Incremental Sync - Sync only updates
5. Sync Genres only
6. Sync Developers only
7. Sync Publishers only
8. Sync Missing Boxart - Find and update games without boxart
9. Show Statistics
10. Exit

Select an option (1-10):
```

**Option 1: Full Sync** - Downloads all games and lookup data for both platforms:
- Fetches all Nintendo Switch games (Platform ID: 4971)
- Fetches all Nintendo Switch 2 games (Platform ID: 5021)
- Downloads lookup data (genres, developers, publishers)
- Prompts whether to sync lookup data (can skip if already synced)
- Supports pagination control and resume from last page
- Can take 10-30 minutes depending on API and number of games

**Option 2: Sync Games Only** - Downloads only games, skips lookup data:
- Useful when you've already synced genres, developers, and publishers
- Faster than full sync as it skips lookup data
- Still supports pagination control and resume

**Option 3: Sync Switch 2 Games Only** - Sync only Nintendo Switch 2 games:
- Syncs only Nintendo Switch 2 platform (Platform ID: 5021)
- Skips Nintendo Switch entirely for faster targeted syncing
- Supports the same page resume mechanism (Resume/Specify/Start)
- Optionally syncs lookup data first

**Option 4: Incremental Sync** - Updates only:
- Checks last sync timestamp
- Downloads only new games since last sync
- Much faster than full sync (typically < 5 minutes)

**Options 5-7: Sync Individual Lookup Data** - Sync only specific lookup data:
- Option 5: Sync only Genres
- Option 6: Sync only Developers
- Option 7: Sync only Publishers

**Option 8: Sync Missing Boxart** - Find and update games without boxart:
- Queries the SQL database for games that have no boxart entries
- Fetches boxart from TheGamesDB API in batches of 20
- Saves boxart to SQL database
- Supports interactive pagination (Continue/Auto-complete/Quit)
- Useful after initial sync or when new games were added without boxart

**Option 9: Show Statistics** - Display cache info:
```
===========================================
Cache Statistics:
===========================================
Total Games Cached: 1,247
Last Sync Time: 2026-01-12 14:30:00 UTC

Lookup Data:
  Genres: ✓ 32 cached
  Developers: ✓ 187 cached
  Publishers: ✓ 215 cached
===========================================
```

### Resume Functionality

If a previous sync was interrupted, when you start a full sync in interactive mode, you'll see:

```
Previous sync progress detected:
  Nintendo Switch: Last successful page was 136

How would you like to proceed?
  [R] Resume from last successful page
  [P] Specify a page number to start from
  [S] Start from the beginning (page 1)

Your choice (R/P/S): R

Resuming from page 136
```

### Lookup Data Prompt

When starting a full sync (Option 1), you'll be asked about lookup data:

```
Do you want to sync lookup data (Genres, Developers, Publishers)?
Note: This is required if you haven't synced them before or want to update them.
Sync lookup data? (Y/N, default Y):
```

This allows you to skip syncing lookup data if you've already synced it, saving time.

### Pagination Control

During a full sync in interactive mode, after each page you'll see:

```
-------------------------------------------
Page 136 completed. 3400 games synced so far.
What would you like to do?
  [C] Continue to next page
  [A] Auto-complete (get the rest without prompting)
  [Q] Quit sync
-------------------------------------------
Your choice (C/A/Q):
```

## Non-Interactive Mode Examples

### Command Line with API Key and Connection String

```bash
# Full sync (from beginning)
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=full

# Games only sync (skip lookup data)
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=games-only

# Resume full sync from page 136
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=full \
  --start-page=136

# Short form
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  -m full \
  -p 136

# Switch 2 only sync
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=switch2

# Switch 2 only sync from page 5
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=switch2 \
  --start-page=5

# Incremental sync (for scheduled tasks)
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=update

# Sync only genres
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=genres

# Show statistics
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=stats

# Sync missing boxart
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=boxart
```

### Using Environment Variables

```bash
# Set environment variables
export TheGamesDB__ApiKey="abc123xyz"
export BlobStorage__ConnectionString="DefaultEndpointsProtocol=https;AccountName=..."

# Run sync
dotnet run -- --mode=full
```

### Using appsettings.json (Recommended)

1. Edit `appsettings.json` with your credentials
2. Run the tool:
   ```bash
   dotnet run -- --mode=full
   ```

## Scheduled Automation

### Linux/macOS (Cron)

Add to crontab (`crontab -e`):
```cron
# Run incremental sync daily at 2 AM
0 2 * * * cd /path/to/GameSyncTool && dotnet run -- --mode=update >> /var/log/gamesync.log 2>&1
```

### Windows (Task Scheduler)

1. Create a batch file `sync.bat`:
   ```batch
   @echo off
   cd C:\path\to\GameSyncTool
   dotnet run -- --mode=update > C:\logs\gamesync.log 2>&1
   ```

2. Create a scheduled task:
   - Open Task Scheduler
   - Create Basic Task
   - Set trigger (e.g., Daily at 2:00 AM)
   - Set action to run `sync.bat`

## Output Examples

### Successful Full Sync
```
===========================================
Switch Library - Game Sync Tool
===========================================

Running in NON-INTERACTIVE mode: full

Starting FULL SYNC...
This will sync all games for Nintendo Switch and Switch 2.
This may take a while depending on the number of games.

info: GameSyncTool.GameSyncService[0]
      Starting full sync for all Switch and Switch 2 games...
info: GameSyncTool.GameSyncService[0]
      Syncing all games for Nintendo Switch (ID: 4971)...
info: GameSyncTool.GameSyncService[0]
      Fetching page 1 for Nintendo Switch...
info: GameSyncTool.GameSyncService[0]
      Retrieved 25 games from page 1
info: GameSyncTool.GameSyncService[0]
      Synced 25 games so far for Nintendo Switch
...
info: GameSyncTool.GameSyncService[0]
      Completed syncing 1,247 games for Nintendo Switch
info: GameSyncTool.GameSyncService[0]
      Syncing lookup data (Genres, Developers, Publishers)...
info: GameSyncTool.GameSyncService[0]
      Synced 32 genres
info: GameSyncTool.GameSyncService[0]
      Synced 187 developers
info: GameSyncTool.GameSyncService[0]
      Synced 215 publishers

✓ Full sync completed successfully in 18.45 minutes!

===========================================
Cache Statistics:
===========================================
Total Games Cached: 1,247
Last Sync Time: 2026-01-12 16:45:30 UTC

Lookup Data:
  Genres: ✓ Cached
  Developers: ✓ Cached
  Publishers: ✓ Cached
===========================================
```

### Incremental Sync with No Updates
```
Starting INCREMENTAL SYNC...
This will sync only games that have been updated since the last sync.

info: GameSyncTool.GameSyncService[0]
      Starting incremental sync for updated games...
info: GameSyncTool.GameSyncService[0]
      Last sync was at: 01/12/2026 14:30:00
info: GameSyncTool.GameSyncService[0]
      Syncing updates for Nintendo Switch (ID: 4971) since 01/12/2026 14:30:00...
info: GameSyncTool.GameSyncService[0]
      Completed syncing 0 updates for Nintendo Switch
info: GameSyncTool.GameSyncService[0]
      Syncing updates for Nintendo Switch 2 (ID: 5021) since 01/12/2026 14:30:00...
info: GameSyncTool.GameSyncService[0]
      Completed syncing 0 updates for Nintendo Switch 2

✓ Incremental sync completed successfully in 0.12 minutes!
```

### Timeout with Retry and Resume
```
info: GameSyncTool.GameSyncService[0]
      Fetching page 136 for Nintendo Switch...
fail: GameSyncTool.GameSyncService[0]
      API request failed: GatewayTimeout
warn: GameSyncTool.GameSyncService[0]
      Retrying in 5000ms (attempt 1/3)...
fail: GameSyncTool.GameSyncService[0]
      API request failed: GatewayTimeout
warn: GameSyncTool.GameSyncService[0]
      Retrying in 10000ms (attempt 2/3)...
fail: GameSyncTool.GameSyncService[0]
      API request failed: GatewayTimeout
warn: GameSyncTool.GameSyncService[0]
      Retrying in 20000ms (attempt 3/3)...
fail: GameSyncTool.GameSyncService[0]
      API request failed: GatewayTimeout
fail: GameSyncTool.GameSyncService[0]
      Failed to fetch page 136 after 3 retries

✗ Full sync failed: API request failed after retries

Last successful page was 135. You can resume with:
  dotnet run -- --mode=full --start-page=136
```

## Troubleshooting

### Error: API Key Not Configured
```
Error: TheGamesDB API Key is not configured!
Please set it in appsettings.json or via command line:
  --TheGamesDB:ApiKey=YOUR_API_KEY
```
**Solution**: Add your API key to `appsettings.json` or pass via command line.

### Error: Blob Storage Not Configured
```
Error: Blob Storage Connection String is not configured!
Please set it in appsettings.json or via command line:
  --BlobStorage:ConnectionString=YOUR_CONNECTION_STRING
```
**Solution**: Add your Azure Storage connection string to `appsettings.json`.

### Error: Connection Refused
```
Error getting statistics: Retry failed after 6 tries... (Connection refused)
```
**Solution**: 
- For local testing: Start Azurite (`azurite` command)
- For production: Verify your Azure Storage connection string is correct

### Rate Limiting
If you encounter rate limiting from TheGamesDB API:
- The tool includes a 2 second delay between page requests
- Consider running syncs less frequently
- Use incremental sync instead of full sync when possible

### Timeout and Gateway Errors
```
fail: GameSyncTool.GameSyncService[0]
      API request failed: GatewayTimeout
```
**What the tool does automatically**:
- Retries failed requests up to 3 times with exponential backoff (5s, 10s, 20s)
- Saves the last successful page number before failing
- HttpClient timeout is set to 5 minutes

**How to resume**:

**Interactive Mode**: When you restart, you'll be prompted to resume:
```
Previous sync progress detected:
  Nintendo Switch: Last successful page was 136

How would you like to proceed?
  [R] Resume from last successful page
  [P] Specify a page number to start from
  [S] Start from the beginning (page 1)

Your choice (R/P/S): R
```

**Non-Interactive Mode**: Use `--start-page` argument:
```bash
# Resume from the last successful page
dotnet run -- --mode=full --start-page=136
```

### Network Errors
```
warn: GameSyncTool.GameSyncService[0]
      Network error on page 136. Retrying in 5000ms (attempt 1/3)...
```
The tool will automatically retry with exponential backoff. If all retries fail, the last successful page is saved and you can resume from there.
