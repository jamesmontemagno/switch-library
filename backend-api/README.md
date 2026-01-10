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
├── SwitchLibraryApi.csproj     # Project file with dependencies
├── host.json                   # Azure Functions host configuration
├── local.settings.json         # Local development settings (not committed)
└── .gitignore                  # Git ignore file
```

## API Endpoints

### TheGamesDB Proxy
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
       "Values": {,
           "BlobStorage__ConnectionString": "UseDevelopmentStorage=true",
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
curl "http://localhost:7071/api/games/12345

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
- `TheGamesDB__ApiKey`: Your TheGamesDB API key
- `BlobStorage__ConnectionString`: Azure Blob Storage connection string (use your storage account connection string in production)
- `BlobStorage__ContainerName`: Name of the blob container for caching game data (default: `games-cache`)

These settings store the API key securely on the server side and enable blob storage caching for game details.

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
