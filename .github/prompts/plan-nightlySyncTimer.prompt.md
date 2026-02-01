# Plan: Nightly Sync Timer Function for Azure Functions Backend

This will add automated nightly syncing of game data from TheGamesDB API using the existing GameSyncTool logic.

## TL;DR
Add an Azure Functions timer trigger that runs nightly (2 AM UTC by default) to perform incremental sync of games. It will use the GameSyncService from GameSyncTool, support Dual storage mode (configurable), and integrate with existing blob/SQL infrastructure. The function will track sync history and handle failures gracefully.

## Steps

1. **Update [SwitchLibraryApi.csproj](backend-api/SwitchLibraryApi.csproj)** to add packages and project reference
   - Add `Microsoft.Azure.Functions.Worker.Extensions.Timer` v4.3.1 (timer trigger support)
   - Add `Dapper` v2.1.66 (for SQL operations)
   - Add `Microsoft.Data.SqlClient` v6.1.4 (SQL connectivity)
   - Add project reference: `<ProjectReference Include="GameSyncTool\GameSyncTool.csproj" />`

2. **Create [backend-api/NightlySyncTimer.cs](backend-api/NightlySyncTimer.cs)** - Timer trigger function
   - Use `[TimerTrigger("0 0 2 * * *")]` attribute (runs daily at 2 AM UTC, configurable via `SyncSchedule` app setting)
   - Inject `GameSyncService` via constructor DI
   - Call `await syncService.SyncUpdatesAsync()` for incremental sync
   - Log start/completion times and game counts
   - Include try/catch for error handling and alerting
   - Return execution summary (games synced, duration, errors)

3. **Update [backend-api/Program.cs](backend-api/Program.cs)** - Register GameSyncService dependencies
   - Add `GameSyncService` to DI container with scoped lifetime
   - Register `BlobServiceClient` (blob storage)
   - Register `SqlDatabaseSettings` from configuration
   - Register `DatabaseInitializer` for SQL schema management
   - Call `DatabaseInitializer.EnsureDatabaseAsync()` at startup if SQL mode enabled
   - Configure HttpClient for TheGamesDB API calls

4. **Update [backend-api/local.settings.json](backend-api/local.settings.json)** - Add sync configuration
   ```json
   {
     "Values": {
       "SyncEnabled": "true",
       "SyncSchedule": "0 0 2 * * *",
       "StorageMode": "Dual",
       "TheGamesDB__ApiKey": "existing-key",
       "ProductionStorage": "existing",
       "BlobStorage__ContainerName": "games-cache",
       "SqlDatabase__ConnectionString": "existing",
       "SqlDatabase__DatabaseName": "switchlibrary-games",
       "SqlDatabase__CommandTimeout": "300",
       "Platforms__NintendoSwitch": "4971",
       "Platforms__NintendoSwitch2": "5021"
     }
   }
   ```

5. **Create [backend-api/SyncSettings.cs](backend-api/SyncSettings.cs)** - Configuration model
   - `SyncEnabled` (bool, default true)
   - `SyncSchedule` (string CRON expression)
   - `StorageMode` (enum: Blob/SqlDatabase/Dual, default Dual)
   - `EnableDatabaseInitialization` (bool, auto-create SQL tables)

6. **Update [backend-api/host.json](backend-api/host.json)** - Configure timer behavior
   - Set `extensions.timers.enableDistributedTracing` to true
   - Configure retry policies for failed syncs
   - Set function timeout to 30 minutes (`functionTimeout`: "00:30:00")

## Verification

**Local Testing**:
```bash
cd backend-api
func start  # Test timer locally (triggers immediately if past schedule)
```

**Manual Trigger** (test endpoint):
```bash
curl http://localhost:7071/admin/functions/NightlySyncTimer -X POST
```

**Check Logs**:
- Console output should show "Nightly sync started"
- Incremental sync progress (lookup data + game updates)
- "Nightly sync completed: X games synced in Y minutes"

**Verify Database**:
```sql
SELECT * FROM sync_metadata;  -- Check last_sync_time updated
SELECT COUNT(*) FROM games_cache;  -- Verify game count
```

## Decisions

**CRON Schedule Decision**: Chose 2 AM UTC (7 PM PST / 10 PM EST) to avoid peak usage hours and give TheGamesDB API time to process daily updates. Configurable via app setting.

**Storage Mode Default**: Set to Dual mode to maintain both blob (Azure Functions compatibility) and SQL (query performance) in sync. Can be changed to SqlDatabase-only in production if blob becomes unnecessary.

**Incremental vs Full Sync**: Using incremental sync (`SyncUpdatesAsync`) instead of full sync to conserve API quota (50 searches/month limit) and reduce execution time. Full sync can be triggered manually via GameSyncTool.

**Error Handling Strategy**: Timer function continues on next schedule even if sync fails. Errors are logged to Application Insights with full stack traces. Consider adding email/Teams notifications for production.

**Database Initialization**: Auto-runs `EnsureDatabaseAsync()` at function app startup when SQL mode is enabled, creating tables if they don't exist. Safe for multiple instances (uses schema_migrations table for version tracking).
