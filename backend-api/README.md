# Switch Library API - Azure Functions Backend

This is the backend API proxy for the Switch Library application, built with Azure Functions and .NET 10 (C#).

## Purpose

This Azure Functions app provides a server-side proxy for TheGamesDB API requests to avoid CORS (Cross-Origin Resource Sharing) issues when the frontend is deployed to production.

## Technology Stack

- **.NET 10** (C#)
- **Azure Functions V4** (Isolated Worker Process)
- **HTTP Trigger Functions**

## Project Structure

```
backend-api/
├── Program.cs                  # Application entry point and dependency injection setup
├── TheGamesDbProxy.cs          # HTTP trigger function for proxying TheGamesDB API requests
├── GetGameById.cs              # HTTP trigger function for getting game details with blob storage caching
├── GetGamesByIds.cs            # HTTP trigger function for bulk game lookups (trending feature)
├── GameSyncTool/               # Console app for syncing games to blob storage
│   ├── Program.cs              # Entry point with interactive/non-interactive modes
│   ├── GameSyncService.cs      # Core sync logic
│   ├── AppSettings.cs          # Configuration model
│   ├── appsettings.json        # Configuration file
│   └── README.md               # Tool documentation
├── SwitchLibraryApi.csproj     # Project file with dependencies
├── host.json                   # Azure Functions host configuration
├── local.settings.json         # Local development settings (not committed)
└── .gitignore                  # Git ignore file
```

## Game Sync Tool

The [GameSyncTool](GameSyncTool/README.md) is a .NET console application for syncing all Nintendo Switch and Nintendo Switch 2 games from TheGamesDB API to Azure Blob Storage. This tool can be run manually or scheduled via cron/Task Scheduler for automated syncing.

**Features:**
- Full sync of all games for both platforms
- Incremental sync for updates
- Interactive menu mode for manual operation
- Non-interactive command-line mode for automation
- Sync lookup data (genres, developers, publishers)
- Statistics and monitoring

See [GameSyncTool/README.md](GameSyncTool/README.md) for complete usage instructions.

## API Endpoints

### SQL Database Endpoints (Public Access)

#### Search Games
- **Route**: `GET /api/search`
- **Description**: Search games from SQL database with filters and pagination
- **Query Parameters**:
  - `query`: Search term
  - `platformId`: Platform ID (4971 = Switch, 5021 = Switch 2)
  - `genreIds`: Comma-separated genre IDs
  - `developerIds`: Comma-separated developer IDs
  - `publisherIds`: Comma-separated publisher IDs
  - `releaseYear`: Filter by release year
  - `coop`: Filter by co-op support (true/false)
  - `minPlayers`: Minimum player count
  - `page`: Page number (default: 1)
  - `pageSize`: Results per page (default: 20, max: 50)
- **Example**: `GET /api/search?query=zelda&platformId=4971&page=1`

#### Get Game By ID
- **Route**: `GET /api/games/{gameId}`
- **Description**: Gets single game details by ID from SQL database
- **Example**: `GET /api/games/12345`

#### Get Games By IDs (Bulk)
- **Route**: `POST /api/games/bulk`
- **Description**: Gets multiple game details by IDs from SQL database
- **Request Body**: 
  ```json
  {
    "ids": [123, 456, 789]
  }
  ```
- **Example**: `POST /api/games/bulk` with body `{"ids": [1, 2, 3]}`

#### Get Upcoming Games
- **Route**: `GET /api/upcoming`
- **Description**: Gets upcoming game releases from SQL database
- **Query Parameters**:
  - `days`: Number of days ahead (default: 90, max: 365)
  - `platformId`: Platform ID filter
  - `page`: Page number (default: 1)
  - `pageSize`: Results per page (default: 20, max: 50)
- **Example**: `GET /api/upcoming?days=90&platformId=4971`

#### Get Game Recommendations
- **Route**: `GET /api/recommendations/{gameId}`
- **Description**: Gets game recommendations based on genres, developers, publishers
- **Query Parameters**:
  - `limit`: Number of recommendations (default: 10, max: 20)
- **Example**: `GET /api/recommendations/12345?limit=10`

#### Get Lookup Data
- **Route**: `GET /api/lookup/{type}`
- **Description**: Gets lookup data (genres, developers, publishers) from SQL database
- **Path Parameter**: `type` - One of: `genres`, `developers`, `publishers`
- **Example**: `GET /api/lookup/genres`

#### Get Database Statistics
- **Route**: `GET /api/stats`
- **Description**: Gets basic database statistics (public access, cached for 5 minutes)
- **Example**: `GET /api/stats`

### Admin Endpoints (Function Key Required)

#### Get Admin Database Statistics
- **Route**: `GET /api/admin/database-stats`
- **Authorization**: Function-level key required
- **Description**: Gets detailed database statistics including sync information, data coverage, and quality metrics
- **Response**:
  ```json
  {
    "totalGames": 50000,
    "switchGames": 45000,
    "switch2Games": 5000,
    "totalGenres": 25,
    "totalDevelopers": 5000,
    "totalPublishers": 3000,
    "lastSyncTime": "2026-02-01T00:00:00Z",
    "syncType": "incremental",
    "gamesSynced": 150,
    "gamesWithBoxart": 48000,
    "gamesWithOverview": 40000,
    "averageRating": 7.2,
    "gamesWithCoop": 12000
  }
  ```
- **Example**: `GET /api/admin/database-stats?code=YOUR_FUNCTION_KEY`
- **Note**: Only accessible by administrators with valid function key. Used by the admin dashboard to display backend database health and statistics.

### TheGamesDB Proxy (Legacy - Still Available)
- **Route**: `GET /api/thegamesdb/{*path}`
- **Description**: Proxies requests to `https://api.thegamesdb.net/v1/{path}` and automatically adds the API key
- **Caching**: When search requests are made (`Games/ByGameName`), automatically caches all returned games to blob storage in the background
- **Example**: `GET /api/thegamesdb/Games/ByGameName?name=zelda`
  - Backend adds the API key and forwards to: `https://api.thegamesdb.net/v1/Games/ByGameName?name=zelda&apikey=xxx`
  - Games in the search results are cached to blob storage for faster future lookups

### Get Game By ID (with Caching)
- **Route**: `GET /api/games/{gameId}`
- **Description**: Gets game details by ID with blob storage caching. Checks blob storage first, then fetches from TheGamesDB API if not found and caches the result
- **Example**: `GET /api/games/12345`
- **Benefits**: 
  - Reduces API calls to TheGamesDB
  - Faster response times for cached games
  - Preserves API allowance

### Get Games By IDs (Bulk Fetch)
- **Route**: `POST /api/games/bulk`
- **Description**: Gets multiple game details by IDs from blob storage cache. Primarily used for the trending games feature
- **Request Body**: 
  ```json
  {
    "ids": [123, 456, 789],
    "includeUncached": false
  }
  ```
- **Response**: Returns array of cached game details
- **Note**: Only fetches from blob storage (no API fallback) to preserve API quota. Set `includeUncached: true` to fetch missing games from API (optional)
- **Example**: `POST /api/games/bulk` with body `{"ids": [1, 2, 3], "includeUncached": false}`

## Local Development

### Prerequisites
- .NET 10 SDK or later
- Azure Functions Core Tools (optional, for advanced testing)

### Running Locally

1. Navigate to the backend-api directory:
   ```bash
   cd backend-api
   ```

2. Configure your API key in `local.settings.json`:
   ```json
   {
       "Values": {
           "TheGamesDB__ApiKey": "YOUR_API_KEY_HERE",
           "ProductionStorage": "UseDevelopmentStorage=true",
           "BlobStorage__ContainerName": "games-cache"
       }
   }
   ```

3. **(Optional) For local blob storage testing**: Install and start [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite):
   ```bash
   npm install -g azurite
   azurite
   ```

4
3. Build the project:
   ```bash
   dotnet build
   ```

4. Run the Functions app:
   ```bash
   dotnet run
   ```
   Or with the Azure Functions Core Tools:
   ```bashendpoints:

**Proxy endpoint:**
```bash
curl "http://localhost:7071/api/thegamesdb/Games/ByGameName?name=zelda"
```

**Cached game details endpoint:**
```bash
curl "http://localhost:7071/api/games/12345"
```

**Bulk game details endpoint:**
```bash
curl -X POST "http://localhost:7071/api/games/bulk" \
  -H "Content-Type: application/json" \
  -d '{"ids": [1, 2, 3], "includeUncached": false}'
```

The API will be available at `http://localhost:7071` by default.

### Testing the API

Once running, you can test the proxy endpoint:
```bash
curl "http://localhost:7071/api/thegamesdb/Games/ByGameName?name=zelda"
```

Note: The API key is automatically added by the backend.

## Deployment to Azure

### Option 1: Azure Portal
1. Create an Azure Function App with .NET 10 runtime
2. Configure CORS to allow your frontend domain
3. Deploy using Visual Studio, VS Code, or Azure CLI

### Option 2: Azure CLI
```bash
# Login to Azure
az login

# Create a resource group
az group create --name SwitchLibraryRG --location eastus

# Create a storage account
az storage account create --name switchlibrarystorage --resource-group SwitchLibraryRG --location eastus --sku Standard_LRS

# Create the Function App
az functionapp create --resource-group SwitchLibraryRG --consumption-plan-location eastus \
  --runtime dotnet-isolated --runtime-version 10 --functions-version 4 \
  --name switchlibrary-api --storage-account switchlibrarystorage

# Deploy the function
func azure functionapp publish switchlibrary-api
```

### Option 3: GitHub Actions / Azure DevOps
Set up CI/CD pipelines to automatically deploy on push to main branch.

## Configuration

### CORS Settings
In Azure Portal, configure CORS for your Function App:
1. Go to your Function App → CORS
2. Add your frontend domain:
   - For custom domain: `https://myswitchlibrary.com`
   - For GitHub Pages: `https://YOUR_USERNAME.github.io`
   - For development: `http://localhost:5173`
3. Click "Save"

**Important:** Do NOT use wildcards (`*`) in production as this defeats the purpose of CORS security.

### Application Settings
Configure the following application settings in the Azure Portal (Function App → Configuration → Application settings):
- `TheGamesDB__ApiKey`: Your TheGamesDB API key (required for nightly sync)
- `SqlDatabase__ConnectionString`: Azure SQL Database connection string
- `ProductionStorage`: Azure Blob Storage connection string (optional, for legacy blob caching)
- `BlobStorage__ContainerName`: Name of the blob container for caching game data (default: `games-cache`)
- `StorageMode`: Storage mode for sync operations (`Sql`, `Blob`, or `Dual`)
- `Sync__SyncEnabled`: Enable/disable nightly sync (default: `true`)

**For Admin Dashboard:**
To enable the admin database statistics endpoint, you need to configure a function key:

1. In Azure Portal, go to your Function App → Functions → GetDatabaseStatsAdmin
2. Click "Function Keys" in the left menu
3. Add a new function key with a name like "admin-dashboard"
4. Copy the key value
5. In your frontend deployment (GitHub Actions secrets or environment variables), add:
   - `VITE_ADMIN_FUNCTION_KEY`: The function key value

This key secures the admin-only statistics endpoint and should only be accessible by authenticated administrators.

## Security Considerations

- The proxy function uses `AuthorizationLevel.Anonymous` to allow public access
- CORS is configured to only allow requests from your frontend domain
- API keys are securely stored in Azure Application Settings (backend) instead of being exposed in the frontend
- Game details are cached in blob storage to reduce API calls and improve performance
- Rate limiting should be implemented at the Azure level if needed

## Monitoring

- Azure Application Insights is integrated for monitoring and logging
- View logs in the Azure Portal under your Function App → Logs
- Track performance, errors, and usage metrics

## Troubleshooting

### Build Errors
- Ensure you have .NET 10 SDK installed: `dotnet --version`
- Clean and rebuild: `dotnet clean && dotnet build`

### CORS Issues
- Verify CORS settings in Azure Portal
- Check that the frontend is using the correct backend URL
- Ensure the Function App is running

### Function Not Found
- Verify the route pattern matches your frontend requests
- Check Function App logs in Azure Portal
