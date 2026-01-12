# Game Sync Tool

A .NET console application for syncing Nintendo Switch and Nintendo Switch 2 games from TheGamesDB API to Azure Blob Storage.

## Features

- **Full Sync**: Download all games for Nintendo Switch and Switch 2 platforms
- **Incremental Sync**: Update only games that have been modified since the last sync
- **Interactive Mode**: User-friendly menu-driven interface
- **Non-Interactive Mode**: Command-line automation for scheduled tasks
- **Lookup Data Sync**: Sync genres, developers, and publishers
- **Statistics**: View cache statistics and sync status

## Prerequisites

- .NET 10.0 or later
- TheGamesDB API Key (get one at [TheGamesDB.net](https://thegamesdb.net/))
- Azure Storage Account (or use Azurite for local development)

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
    "NintendoSwitch": 4918,
    "NintendoSwitch2": 4950
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
1. Full Sync - Sync all games
2. Incremental Sync - Sync only updates
3. Show Statistics
4. Exit

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
   - Fetches all games for Nintendo Switch (Platform ID: 4918)
   - Fetches all games for Nintendo Switch 2 (Platform ID: 4950)
   - Fetches lookup data (genres, developers, publishers)
   - Saves all data to Azure Blob Storage as JSON files
   - Each game is saved as `game-{id}.json`

2. **Incremental Sync**:
   - Reads the last sync timestamp from blob storage
   - Fetches games that were updated since the last sync
   - Updates the last sync timestamp

3. **Storage Format**:
   - Games: `game-{id}.json` (e.g., `game-12345.json`)
   - Genres: `lookup-genres.json`
   - Developers: `lookup-developers.json`
   - Publishers: `lookup-publishers.json`
   - Last Sync: `last-sync.txt`

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

TheGamesDB API has rate limits. The tool includes a 500ms delay between page requests to avoid hitting rate limits. If you still encounter rate limiting, you can modify the delay in `GameSyncService.cs`.

## Platform IDs

The following platform IDs are used:
- **Nintendo Switch**: 4918
- **Nintendo Switch 2**: 4950

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
