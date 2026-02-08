# Game Sync Tool

A .NET console application for syncing Nintendo Switch and Nintendo Switch 2 games from TheGamesDB API to Azure Blob Storage.

## Features

- **Full Sync**: Download all games for Nintendo Switch and Switch 2 platforms
- **Switch 2 Only Sync**: Sync only Nintendo Switch 2 games with page resume support
- **Incremental Sync**: Update only games that have been modified since the last sync
- **Interactive Mode**: User-friendly menu-driven interface with pagination control
- **Non-Interactive Mode**: Command-line automation for scheduled tasks
- **Resume Capability**: Resume interrupted syncs from the last successful page
- **Retry Logic**: Automatic retry with exponential backoff for timeout and network errors
- **Lookup Data Sync**: Sync genres, developers, and publishers
- **Statistics**: View cache statistics and sync status

## Prerequisites

- .NET 10.0 or later
- TheGamesDB API Key (get one at [TheGamesDB.net](https://thegamesdb.net/))
- Azure Storage Account (or use Azurite for local development)

## CI/CD and Build Pipeline

The GameSyncTool has a simple automated build configured via GitHub Actions as a smoke test:

**Build Pipeline**: `.github/workflows/build-gamesync.yml` includes a job that:
- Runs only when changes are made to `backend-api/GameSyncTool/**` or the workflow file itself
- Supports manual triggering via workflow_dispatch
- Restores NuGet dependencies
- Builds the project in Release configuration on Linux
- Runs tests (if available)

This ensures the tool builds successfully without errors as a basic validation while avoiding unnecessary builds when unrelated files change.

## Configuration

### appsettings.json

Configure the tool by editing `appsettings.json`:

```json
{
  "TheGamesDB": {
    "ApiKey": "YOUR_API_KEY_HERE",
    "BaseUrl": "https://api.thegamesdb.net/",
    "Version": 1
  },
  "BlobStorage": {
    "ConnectionString": "YOUR_CONNECTION_STRING_HERE",
    "ContainerName": "games-cache"
  },
  "Platforms": {
    "NintendoSwitch": 4971,
    "NintendoSwitch2": 5021
  }
}
```

### Environment Variables

You can also configure via environment variables:

```bash
export TheGamesDB__ApiKey="your-api-key"
export BlobStorage__ConnectionString="your-connection-string"
```

### Command Line Arguments

Or pass configuration via command line:

```bash
dotnet run -- --TheGamesDB:ApiKey=your-api-key --BlobStorage:ConnectionString=your-connection-string
```

## Building

```bash
cd backend-api/GameSyncTool
dotnet build
```

## Usage

### Interactive Mode (Default)

Run without any arguments for an interactive menu:

```bash
dotnet run
```

You'll see a menu with options:
1. Full Sync - Sync all games and lookup data
2. Sync Games Only - Sync games without lookup data
3. Sync Switch 2 Games Only - Sync only Nintendo Switch 2 games
4. Incremental Sync - Sync only updates
5. Sync Genres only
6. Sync Developers only
7. Sync Publishers only
8. Show Statistics
9. Exit

### Non-Interactive Mode

For automation and scheduled tasks:

#### Full Sync

```bash
dotnet run -- --mode=full
```

Or:

```bash
dotnet run -- --mode=all
```

##### Games Only Sync

If you've already synced lookup data (genres, developers, publishers) and only want to sync games:

```bash
dotnet run -- --mode=games
# or
dotnet run -- --mode=games-only
```

#### Switch 2 Only Sync

Sync only Nintendo Switch 2 games (skips Nintendo Switch entirely):

```bash
dotnet run -- --mode=switch2
# or
dotnet run -- --mode=switch2-only
```

With a specific start page:

```bash
dotnet run -- --mode=switch2 --start-page=5
# Short form
dotnet run -- -m switch2 -p 5
```

In interactive mode, this option supports the same page resume mechanism as the full sync — you can resume from the last successful page, specify a page number, or start from the beginning.

##### Resume from Last Page

If a previous sync was interrupted, you can resume from the last successful page:

**Interactive Mode** (default): When you start a full sync in interactive mode, if there's a previous sync with a saved page number, you'll be prompted:

```
Previous sync progress detected:
  Nintendo Switch: Last successful page was 136

How would you like to proceed?
  [R] Resume from last successful page
  [P] Specify a page number to start from
  [S] Start from the beginning (page 1)

Your choice (R/P/S):
```

**Non-Interactive Mode**: Use the `--start-page` argument:

```bash
# Resume from page 136
dotnet run -- --mode=full --start-page=136

# Short form
dotnet run -- -m full -p 136
```

#### Incremental Sync

```bash
dotnet run -- --mode=update
```

Or:

```bash
dotnet run -- --mode=incremental
```

#### Show Statistics

```bash
dotnet run -- --mode=stats
```

### Short Mode Flag

You can also use `-m` as a shorthand for `--mode`:

```bash
dotnet run -- -m full
dotnet run -- -m update
dotnet run -- -m stats
```

## Local Development with Azurite

For local development, you can use Azurite (Azure Storage Emulator):

1. Install Azurite:
   ```bash
   npm install -g azurite
   ```

2. Start Azurite:
   ```bash
   azurite --silent --location /tmp/azurite --debug /tmp/azurite/debug.log
   ```

3. Use the development connection string in `appsettings.json`:
   ```json
   {
     "BlobStorage": {
       "ConnectionString": "UseDevelopmentStorage=true",
       "ContainerName": "games-cache"
     }
   }
   ```

## Production Deployment

### Publishing

Build a self-contained executable:

```bash
# For Linux
dotnet publish -c Release -r linux-x64 --self-contained

# For Windows
dotnet publish -c Release -r win-x64 --self-contained

# For macOS
dotnet publish -c Release -r osx-x64 --self-contained
```

The published application will be in `bin/Release/net10.0/<runtime>/publish/`

### Scheduled Execution

#### Windows Task Scheduler

1. Create a batch file (`sync-games.bat`):
   ```batch
   @echo off
   cd C:\path\to\GameSyncTool
   GameSyncTool.exe --mode=update
   ```

2. Create a scheduled task to run this batch file

#### Linux Cron

1. Make the executable:
   ```bash
   chmod +x GameSyncTool
   ```

2. Add to crontab:
   ```bash
   # Run incremental sync daily at 2 AM
   0 2 * * * cd /path/to/GameSyncTool && ./GameSyncTool --mode=update
   ```

#### Azure Functions Timer Trigger

You can also integrate this tool into an Azure Function for serverless execution:

```csharp
[Function("GameSyncTimer")]
public async Task Run([TimerTrigger("0 0 2 * * *")] TimerInfo myTimer)
{
    // Call the sync logic here
}
```

## How It Works

1. **Full Sync**: 
   - Fetches all games for Nintendo Switch (Platform ID: 4971)
   - Fetches all games for Nintendo Switch 2 (Platform ID: 5021)
   - Fetches lookup data (genres, developers, publishers)
   - Saves all data to Azure Blob Storage as JSON files
   - Each game is saved as `game-{id}.json`
   - Tracks the last successful page for resume capability

2. **Incremental Sync**:
   - Reads the last sync timestamp from blob storage / SQL
   - Calculates minutes since last sync
   - Calls TheGamesDB Updates endpoint with `time={minutes}` to get recent edits
   - Groups update entries by `game_id` into change sets, detecting:
     - **New games** (`type=game, value=[NEW]`): Platform checked inline — non-Switch games skipped immediately with zero API calls. Switch games saved directly from update fields.
     - **Removed games** (`type=game, value=[REMOVED]`): Deleted from cache if present.
     - **Field updates**: Applied directly via SQL UPDATE for games already in our database. Games not in our DB are skipped (not Switch).
   - Image-only updates (boxart, screenshots, etc.) are skipped since we don't store those
   - Nearly all individual `/Games/ByGameID` API calls are eliminated
   - Updates the last sync timestamp

3. **Retry Logic**:
   - Automatically retries failed API requests up to 3 times
   - Uses exponential backoff (5s, 10s, 20s delays)
   - Handles timeouts, gateway errors, and network issues
   - Saves the last successful page before failing
   - HttpClient timeout increased to 5 minutes for slow responses

4. **Storage Format**:
   - Games: `game-{id}.json` (e.g., `game-12345.json`)
   - Genres: `lookup-genres.json`
   - Developers: `lookup-developers.json`
   - Publishers: `lookup-publishers.json`
   - Last Sync: `last-sync.txt` (timestamp|syncType|count)
   - Last Page (per platform): `last-page-platform-{id}.txt` (e.g., `last-page-platform-4971.txt`)

## Troubleshooting

### API Key Not Configured

```
Error: TheGamesDB API Key is not configured!
```

Solution: Set your API key in `appsettings.json` or via command line.

### Blob Storage Connection Failed

```
Error: Blob Storage Connection String is not configured!
```

Solution: Set your Azure Storage connection string in `appsettings.json`.

### Rate Limiting

TheGamesDB API has rate limits. The tool includes a 2 second delay between page requests to avoid hitting rate limits. If you still encounter rate limiting, you can modify the delay in `GameSyncService.cs`.

### Timeout Errors

If you encounter `GatewayTimeout` or `RequestTimeout` errors:

**What the tool does automatically**:
- Retries failed requests up to 3 times
- Uses exponential backoff (5s, 10s, 20s)
- Saves the last successful page before failing
- HttpClient timeout is set to 5 minutes

**What you can do**:
- Resume from the last successful page (see "Resume from Last Page" above)
- The tool will prompt you in interactive mode
- In non-interactive mode, use `--start-page=<page-number>`

**Example**: If sync fails at page 140:
```bash
# Resume from where it left off
dotnet run -- --mode=full --start-page=140
```

## Platform IDs

The following platform IDs are used:
- **Nintendo Switch**: 4971
- **Nintendo Switch 2**: 5021

These IDs are configured in `appsettings.json` and can be modified if needed.

## Architecture

The tool consists of three main components:

1. **Program.cs**: Main entry point, handles interactive and non-interactive modes
2. **GameSyncService.cs**: Core sync logic for fetching and storing games
3. **AppSettings.cs**: Configuration model

The tool uses:
- **TheGamesDBApiWrapper**: NuGet package for accessing TheGamesDB API
- **Azure.Storage.Blobs**: For storing data in Azure Blob Storage
- **Microsoft.Extensions.Configuration**: For configuration management
- **Microsoft.Extensions.Logging**: For logging

## Contributing

When contributing to this tool, please ensure:
- Code follows existing patterns
- Error handling is comprehensive
- Logging is informative but not verbose
- Rate limiting is respected

## License

This tool is part of the Switch Library project. See the main project LICENSE for details.
