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
1. Full Sync - Sync all games
2. Incremental Sync - Sync only updates
3. Show Statistics
4. Exit

Select an option (1-4):
```

**Option 1: Full Sync** - Downloads all games for both platforms:
- Fetches all Nintendo Switch games (Platform ID: 4918)
- Fetches all Nintendo Switch 2 games (Platform ID: 4950)
- Downloads lookup data (genres, developers, publishers)
- Can take 10-30 minutes depending on API and number of games

**Option 2: Incremental Sync** - Updates only:
- Checks last sync timestamp
- Downloads only new games since last sync
- Much faster than full sync (typically < 5 minutes)

**Option 3: Show Statistics** - Display cache info:
```
===========================================
Cache Statistics:
===========================================
Total Games Cached: 1,247
Last Sync Time: 2026-01-12 14:30:00 UTC

Lookup Data:
  Genres: ✓ Cached
  Developers: ✓ Cached
  Publishers: ✓ Cached
===========================================
```

## Non-Interactive Mode Examples

### Command Line with API Key and Connection String

```bash
# Full sync
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=full

# Incremental sync (for scheduled tasks)
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=update

# Show statistics
dotnet run -- \
  --TheGamesDB:ApiKey=abc123xyz \
  --BlobStorage:ConnectionString="DefaultEndpointsProtocol=https;AccountName=..." \
  --mode=stats
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
      Syncing all games for Nintendo Switch (ID: 4918)...
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
      Syncing updates for Nintendo Switch (ID: 4918) since 01/12/2026 14:30:00...
info: GameSyncTool.GameSyncService[0]
      Completed syncing 0 updates for Nintendo Switch
info: GameSyncTool.GameSyncService[0]
      Syncing updates for Nintendo Switch 2 (ID: 4950) since 01/12/2026 14:30:00...
info: GameSyncTool.GameSyncService[0]
      Completed syncing 0 updates for Nintendo Switch 2

✓ Incremental sync completed successfully in 0.12 minutes!
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
- The tool includes a 500ms delay between page requests
- Consider running syncs less frequently
- Use incremental sync instead of full sync when possible
