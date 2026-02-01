using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;

namespace GameSyncTool;

public partial class GameSyncService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly string _containerName;
    private readonly ILogger<GameSyncService> _logger;
    private readonly int _switchPlatformId;
    private readonly int _switch2PlatformId;
    private readonly StorageMode _storageMode;
    private const string ApiBaseUrl = "https://api.thegamesdb.net/v1";
    private const int MaxRetries = 3;
    private const int InitialRetryDelayMs = 5000; // 5 seconds

    public GameSyncService(
        HttpClient httpClient,
        TheGamesDBSettings gamesDbSettings,
        BlobStorageSettings blobSettings,
        SqlDatabaseSettings sqlSettings,
        PlatformsSettings platformSettings,
        StorageMode storageMode,
        ILogger<GameSyncService> logger)
    {
        _httpClient = httpClient;
        _apiKey = gamesDbSettings.ApiKey;
        _blobServiceClient = new BlobServiceClient(blobSettings.ConnectionString);
        _containerName = blobSettings.ContainerName;
        _sqlSettings = sqlSettings;
        _storageMode = storageMode;
        _logger = logger;
        _switchPlatformId = platformSettings.NintendoSwitch;
        _switch2PlatformId = platformSettings.NintendoSwitch2;
    }

    // =============================================
    // Storage Abstraction Methods
    // =============================================

    /// <summary>
    /// Save game data using configured storage mode
    /// </summary>
    private async Task SaveGameAsync(int gameId, JsonElement gameData)
    {
        switch (_storageMode)
        {
            case StorageMode.Blob:
                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                await SaveGameToBlobAsync(containerClient, gameId, gameData);
                break;

            case StorageMode.SqlDatabase:
                await SaveGameToSqlAsync(gameId, gameData);
                break;

            case StorageMode.Dual:
                // Write to both storage systems in parallel
                var containerClientDual = _blobServiceClient.GetBlobContainerClient(_containerName);
                await Task.WhenAll(
                    SaveGameToBlobAsync(containerClientDual, gameId, gameData),
                    SaveGameToSqlAsync(gameId, gameData)
                );
                break;
        }
    }

    /// <summary>
    /// Get game data using configured storage mode (SQL takes priority in dual mode)
    /// </summary>
    private async Task<object?> GetGameAsync(int gameId)
    {
        switch (_storageMode)
        {
            case StorageMode.Blob:
                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                return await GetGameFromBlobAsync(containerClient, gameId);

            case StorageMode.SqlDatabase:
            case StorageMode.Dual:
                // In dual mode, prefer SQL as it's structured and faster to query
                return await GetGameFromSqlAsync(gameId);

            default:
                return null;
        }
    }

    /// <summary>
    /// Save lookup data using configured storage mode
    /// </summary>
    private async Task SaveLookupDataAsync(string lookupType, JsonElement data)
    {
        switch (_storageMode)
        {
            case StorageMode.Blob:
                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                await SaveLookupDataToBlobAsync(containerClient, lookupType, data);
                break;

            case StorageMode.SqlDatabase:
                await SaveLookupDataToSqlAsync(lookupType, data);
                break;

            case StorageMode.Dual:
                var containerClientDual = _blobServiceClient.GetBlobContainerClient(_containerName);
                await Task.WhenAll(
                    SaveLookupDataToBlobAsync(containerClientDual, lookupType, data),
                    SaveLookupDataToSqlAsync(lookupType, data)
                );
                break;
        }
    }

    /// <summary>
    /// Get last sync time - always from blob storage (sync metadata, not game data)
    /// </summary>
    private async Task<DateTime?> GetLastSyncTimeAsync()
    {
        // Try SQL first if available
        if (_storageMode == StorageMode.SqlDatabase || _storageMode == StorageMode.Dual)
        {
            var sqlResult = await GetLastSyncTimeFromSqlAsync();
            if (sqlResult.Item1.HasValue)
            {
                return sqlResult.Item1;
            }
        }

        // Fall back to blob storage
        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
        return await GetLastSyncTimeFromBlobAsync(containerClient);
    }

    /// <summary>
    /// Save last sync time to both blob and SQL (based on storage mode)
    /// </summary>
    private async Task SaveLastSyncTimeAsync(string syncType = "full", int gamesSynced = 0)
    {
        // Always save to blob (for backward compatibility and metadata)
        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
        await SaveLastSyncTimeToBlobAsync(containerClient, syncType, gamesSynced);

        // Also save to SQL if available
        if (_storageMode == StorageMode.SqlDatabase || _storageMode == StorageMode.Dual)
        {
            await SaveLastSyncTimeToSqlAsync(syncType, gamesSynced);
        }
    }

    // =============================================
    // Platform Sync Methods
    // =============================================

    /// <summary>
    /// Sync all games for Nintendo Switch and Switch 2 platforms
    /// </summary>
    /// <param name="interactiveMode">Enable interactive pagination prompts</param>
    /// <param name="switchStartPage">Page number to start syncing Nintendo Switch from (default: 1)</param>
    /// <param name="switch2StartPage">Page number to start syncing Nintendo Switch 2 from (default: 1)</param>
    /// <param name="syncLookupData">Whether to sync lookup data (genres, developers, publishers) before games</param>
    public async Task SyncAllGamesAsync(bool interactiveMode = false, int switchStartPage = 1, int switch2StartPage = 1, bool syncLookupData = true)
    {
        _logger.LogInformation("Starting full sync for all Switch and Switch 2 games...");

        // Ensure container exists (only needed for blob mode)
        if (_storageMode == StorageMode.Blob || _storageMode == StorageMode.Dual)
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            await containerClient.CreateIfNotExistsAsync();
        }

        // IMPORTANT: Sync lookup data FIRST (games reference these via foreign keys)
        if (syncLookupData)
        {
            await SyncLookupDataAsync();
        }
        else
        {
            _logger.LogInformation("Skipping lookup data sync (genres, developers, publishers)");
        }

        // Now sync games (they can reference the lookup data)
        var switchCount = await SyncPlatformGamesAsync(_switchPlatformId, "Nintendo Switch", interactiveMode, switchStartPage);
        var switch2Count = await SyncPlatformGamesAsync(_switch2PlatformId, "Nintendo Switch 2", interactiveMode, switch2StartPage);

        // Update the last sync timestamp with total games synced
        await SaveLastSyncTimeAsync("full", switchCount + switch2Count);

        _logger.LogInformation("Full sync completed successfully!");
    }

    /// <summary>
    /// Sync only games that have been updated since the last sync
    /// </summary>
    public async Task SyncUpdatesAsync()
    {
        _logger.LogInformation("Starting incremental sync for updated games and lookup data...");

        // Ensure container exists (only needed for blob mode)
        if (_storageMode == StorageMode.Blob || _storageMode == StorageMode.Dual)
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            await containerClient.CreateIfNotExistsAsync();
        }

        // Sync lookup data first (genres, developers, publishers)
        await SyncLookupDataAsync();

        // Get the last sync timestamp
        var lastSyncTime = await GetLastSyncTimeAsync();
        _logger.LogInformation("Last sync was at: {LastSyncTime}", lastSyncTime);

        // Sync updates for both platforms
        var switchCount = await SyncPlatformUpdatesAsync(_switchPlatformId, "Nintendo Switch", lastSyncTime);
        var switch2Count = await SyncPlatformUpdatesAsync(_switch2PlatformId, "Nintendo Switch 2", lastSyncTime);

        // Update the last sync timestamp with total games synced
        await SaveLastSyncTimeAsync("incremental", switchCount + switch2Count);

        _logger.LogInformation("Incremental sync completed successfully!");
    }

    private async Task<int> SyncPlatformGamesAsync(int platformId, string platformName, bool interactiveMode = false, int startPage = 1)
    {
        _logger.LogInformation("Syncing all games for {Platform} (ID: {PlatformId}) starting from page {StartPage}...", platformName, platformId, startPage);

        try
        {
            var page = startPage;
            var totalSynced = 0;
            var autoComplete = false; // Track if user chose "get the rest"

            while (true)
            {
                _logger.LogInformation("Fetching page {Page} for {Platform}...", page, platformName);

                // Fetch games by platform with pagination (with retry logic)
                JsonDocument? jsonDoc = null;
                var retryCount = 0;
                var success = false;

                while (retryCount <= MaxRetries && !success)
                {
                    try
                    {
                        var url = $"{ApiBaseUrl}/Games/ByPlatformID?apikey={_apiKey}&id={platformId}&page={page}";
                        var response = await _httpClient.GetAsync(url);

                        if (!response.IsSuccessStatusCode)
                        {
                            _logger.LogError("API request failed: {StatusCode}", response.StatusCode);
                            
                            // If it's a timeout or server error, retry
                            if (response.StatusCode == System.Net.HttpStatusCode.GatewayTimeout ||
                                response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable ||
                                response.StatusCode == System.Net.HttpStatusCode.RequestTimeout)
                            {
                                retryCount++;
                                if (retryCount <= MaxRetries)
                                {
                                    var delay = InitialRetryDelayMs * (int)Math.Pow(2, retryCount - 1);
                                    _logger.LogWarning("Retrying in {Delay}ms (attempt {Attempt}/{MaxRetries})...", delay, retryCount, MaxRetries);
                                    await Task.Delay(delay);
                                    continue;
                                }
                            }
                            
                            // Save last successful page before failing
                            if (page > 1)
                            {
                                await SaveLastSuccessfulPageAsync(platformId, page - 1);
                            }
                            break;
                        }

                        var content = await response.Content.ReadAsStringAsync();
                        jsonDoc = JsonDocument.Parse(content);
                        success = true;
                    }
                    catch (HttpRequestException ex) when (ex.InnerException is System.Net.Sockets.SocketException)
                    {
                        retryCount++;
                        if (retryCount <= MaxRetries)
                        {
                            var delay = InitialRetryDelayMs * (int)Math.Pow(2, retryCount - 1);
                            _logger.LogWarning(ex, "Network error on page {Page}. Retrying in {Delay}ms (attempt {Attempt}/{MaxRetries})...", page, delay, retryCount, MaxRetries);
                            await Task.Delay(delay);
                        }
                        else
                        {
                            _logger.LogError(ex, "Network error on page {Page} after {MaxRetries} retries", page, MaxRetries);
                            // Save last successful page
                            if (page > 1)
                            {
                                await SaveLastSuccessfulPageAsync(platformId, page - 1);
                            }
                            throw;
                        }
                    }
                    catch (TaskCanceledException ex)
                    {
                        retryCount++;
                        if (retryCount <= MaxRetries)
                        {
                            var delay = InitialRetryDelayMs * (int)Math.Pow(2, retryCount - 1);
                            _logger.LogWarning(ex, "Request timeout on page {Page}. Retrying in {Delay}ms (attempt {Attempt}/{MaxRetries})...", page, delay, retryCount, MaxRetries);
                            await Task.Delay(delay);
                        }
                        else
                        {
                            _logger.LogError(ex, "Request timeout on page {Page} after {MaxRetries} retries", page, MaxRetries);
                            // Save last successful page
                            if (page > 1)
                            {
                                await SaveLastSuccessfulPageAsync(platformId, page - 1);
                            }
                            throw;
                        }
                    }
                }

                if (!success || jsonDoc == null)
                {
                    _logger.LogError("Failed to fetch page {Page} after {MaxRetries} retries", page, MaxRetries);
                    break;
                }

                // Check if there are games in the response
                if (!jsonDoc.RootElement.TryGetProperty("data", out var data))
                {
                    _logger.LogWarning("No 'data' property in response for {Platform} page {Page}", platformName, page);
                    break;
                }

                if (!data.TryGetProperty("games", out var gamesArray))
                {
                    _logger.LogWarning("No 'games' property in response for {Platform} page {Page}", platformName, page);
                    break;
                }

                if (gamesArray.GetArrayLength() == 0)
                {
                    _logger.LogInformation("No more games found for {Platform} on page {Page}", platformName, page);
                    break;
                }

                _logger.LogInformation("Retrieved {Count} games from page {Page}", gamesArray.GetArrayLength(), page);

                // Save each game to storage
                foreach (var game in gamesArray.EnumerateArray())
                {
                    if (game.TryGetProperty("id", out var idProp))
                    {
                        var gameId = idProp.GetInt32();
                        await SaveGameAsync(gameId, game);
                        totalSynced++;
                    }
                }

                _logger.LogInformation("Synced {Total} games so far for {Platform}", totalSynced, platformName);

                // Save last successful page
                await SaveLastSuccessfulPageAsync(platformId, page);

                // Interactive pagination prompt (only if in interactive mode and not auto-completing)
                if (interactiveMode && !autoComplete)
                {
                    Console.WriteLine();
                    Console.WriteLine("-------------------------------------------");
                    Console.WriteLine($"Page {page} completed. {totalSynced} games synced so far.");
                    Console.WriteLine("What would you like to do?");
                    Console.WriteLine("  [C] Continue to next page");
                    Console.WriteLine("  [A] Auto-complete (get the rest without prompting)");
                    Console.WriteLine("  [Q] Quit sync");
                    Console.WriteLine("-------------------------------------------");
                    Console.Write("Your choice (C/A/Q): ");
                    
                    var choice = Console.ReadLine()?.Trim().ToUpperInvariant();
                    Console.WriteLine();

                    switch (choice)
                    {
                        case "Q":
                            _logger.LogWarning("Sync cancelled by user at page {Page}", page);
                            Console.WriteLine($"Sync cancelled. {totalSynced} games synced.");
                            return totalSynced;

                        case "A":
                            _logger.LogInformation("Auto-complete mode enabled by user");
                            Console.WriteLine("Auto-completing remaining pages...");
                            autoComplete = true;
                            break;

                        case "C":
                        case "":
                            // Continue to next page (default)
                            break;

                        default:
                            _logger.LogWarning("Invalid choice '{Choice}', continuing to next page", choice);
                            Console.WriteLine("Invalid choice. Continuing to next page...");
                            break;
                    }
                }

                // Check if there are more pages
                if (!jsonDoc.RootElement.TryGetProperty("pages", out var pages))
                {
                    _logger.LogWarning("No 'pages' property in response for {Platform} page {Page}", platformName, page);
                    break;
                }

                _logger.LogDebug("Pages object: {Pages}", pages.ToString());

                if (!pages.TryGetProperty("next", out var nextPage) || nextPage.ValueKind == JsonValueKind.Null)
                {
                    _logger.LogInformation("No more pages available for {Platform} - completed at page {Page}", platformName, page);
                    break;
                }

                _logger.LogDebug("Next page value: {NextPage} (ValueKind: {ValueKind})", nextPage.ToString(), nextPage.ValueKind);
                
                page++;

                // Add a delay to avoid rate limiting (2 seconds between pages)
                _logger.LogDebug("Waiting 2 seconds before fetching next page...");
                await Task.Delay(2000);
            }

            _logger.LogInformation("Completed syncing {Total} games for {Platform}", totalSynced, platformName);
            return totalSynced;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing games for {Platform}", platformName);
            throw;
        }
    }

    private async Task<int> SyncPlatformUpdatesAsync(int platformId, string platformName, DateTime? since)
    {
        _logger.LogInformation("Syncing updates for {Platform} (ID: {PlatformId}) since {Since}...", 
            platformName, platformId, since?.ToString() ?? "beginning");

        try
        {
            var page = 1;
            var totalSynced = 0;

            while (true)
            {
                _logger.LogInformation("Fetching page {Page} for {Platform} updates...", page, platformName);

                var url = $"{ApiBaseUrl}/Games/ByPlatformID?apikey={_apiKey}&id={platformId}&page={page}";
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("API request failed: {StatusCode}", response.StatusCode);
                    break;
                }

                var content = await response.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(content);

                if (!jsonDoc.RootElement.TryGetProperty("data", out var data) ||
                    !data.TryGetProperty("games", out var gamesArray) ||
                    gamesArray.GetArrayLength() == 0)
                {
                    _logger.LogInformation("No more games found for {Platform}", platformName);
                    break;
                }

                var gamesProcessed = 0;

                foreach (var game in gamesArray.EnumerateArray())
                {
                    if (!game.TryGetProperty("id", out var idProp))
                        continue;

                    var gameId = idProp.GetInt32();

                    // Check if game needs updating
                    if (since.HasValue)
                    {
                        var existingGame = await GetGameAsync(gameId);
                        if (existingGame != null)
                        {
                            // Game exists, skip if not updated
                            continue;
                        }
                    }

                    await SaveGameAsync(gameId, game);
                    totalSynced++;
                    gamesProcessed++;
                }

                _logger.LogInformation("Processed {Processed} games from page {Page}, {Total} total updates for {Platform}", 
                    gamesProcessed, page, totalSynced, platformName);

                if (!jsonDoc.RootElement.TryGetProperty("pages", out var pages) ||
                    !pages.TryGetProperty("next", out var nextPage) ||
                    nextPage.ValueKind == JsonValueKind.Null)
                {
                    break;
                }

                page++;
                await Task.Delay(2000);
            }

            _logger.LogInformation("Completed syncing {Total} updates for {Platform}", totalSynced, platformName);
            return totalSynced;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing updates for {Platform}", platformName);
            throw;
        }
    }

    private async Task SyncLookupDataAsync()
    {
        _logger.LogInformation("Syncing lookup data (Genres, Developers, Publishers)...");

        try
        {
            await SyncGenresAsync();
            await SyncDevelopersAsync();
            await SyncPublishersAsync();

            _logger.LogInformation("Completed syncing lookup data");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing lookup data");
            throw;
        }
    }

    /// <summary>
    /// Sync only genres lookup data
    /// </summary>
    public async Task SyncGenresAsync()
    {
        _logger.LogInformation("Syncing Genres...");
        try
        {
            var genresUrl = $"{ApiBaseUrl}/Genres?apikey={_apiKey}";
            var genresResponse = await _httpClient.GetAsync(genresUrl);
            if (genresResponse.IsSuccessStatusCode)
            {
                var content = await genresResponse.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(content);
                await SaveLookupDataAsync("genres", jsonDoc.RootElement);
                
                if (jsonDoc.RootElement.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("genres", out var genres))
                {
                    var count = genres.ValueKind == JsonValueKind.Array ? genres.GetArrayLength() : genres.EnumerateObject().Count();
                    _logger.LogInformation("Synced {Count} genres", count);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing genres");
            throw;
        }
    }

    /// <summary>
    /// Sync only developers lookup data
    /// </summary>
    public async Task SyncDevelopersAsync()
    {
        _logger.LogInformation("Syncing Developers...");
        try
        {
            var developersUrl = $"{ApiBaseUrl}/Developers?apikey={_apiKey}";
            var developersResponse = await _httpClient.GetAsync(developersUrl);
            if (developersResponse.IsSuccessStatusCode)
            {
                var content = await developersResponse.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(content);
                await SaveLookupDataAsync("developers", jsonDoc.RootElement);
                
                if (jsonDoc.RootElement.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("developers", out var developers))
                {
                    var count = developers.ValueKind == JsonValueKind.Array ? developers.GetArrayLength() : developers.EnumerateObject().Count();
                    _logger.LogInformation("Synced {Count} developers", count);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing developers");
            throw;
        }
    }

    /// <summary>
    /// Sync only publishers lookup data
    /// </summary>
    public async Task SyncPublishersAsync()
    {
        _logger.LogInformation("Syncing Publishers...");
        try
        {
            var publishersUrl = $"{ApiBaseUrl}/Publishers?apikey={_apiKey}";
            var publishersResponse = await _httpClient.GetAsync(publishersUrl);
            if (publishersResponse.IsSuccessStatusCode)
            {
                var content = await publishersResponse.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(content);
                await SaveLookupDataAsync("publishers", jsonDoc.RootElement);
                
                if (jsonDoc.RootElement.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("publishers", out var publishers))
                {
                    var count = publishers.ValueKind == JsonValueKind.Array ? publishers.GetArrayLength() : publishers.EnumerateObject().Count();
                    _logger.LogInformation("Synced {Count} publishers", count);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing publishers");
            throw;
        }
    }

    private async Task SaveGameToBlobAsync(BlobContainerClient containerClient, int gameId, JsonElement gameData)
    {
        try
        {
            var blobClient = containerClient.GetBlobClient($"game-{gameId}.json");

            var json = JsonSerializer.Serialize(gameData, new JsonSerializerOptions
            {
                WriteIndented = true
            });

            var bytes = Encoding.UTF8.GetBytes(json);

            using var stream = new MemoryStream(bytes);
            await blobClient.UploadAsync(stream, overwrite: true);

            _logger.LogDebug("Saved game {GameId} to blob storage", gameId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving game {GameId} to blob storage", gameId);
        }
    }

    private async Task<object?> GetGameFromBlobAsync(BlobContainerClient containerClient, int gameId)
    {
        try
        {
            var blobClient = containerClient.GetBlobClient($"game-{gameId}.json");

            if (!await blobClient.ExistsAsync())
            {
                return null;
            }

            var response = await blobClient.DownloadContentAsync();
            var json = response.Value.Content.ToString();
            return JsonSerializer.Deserialize<object>(json);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error reading game {GameId} from blob storage", gameId);
            return null;
        }
    }

    private async Task SaveLookupDataToBlobAsync(BlobContainerClient containerClient, string lookupType, JsonElement data)
    {
        try
        {
            var blobClient = containerClient.GetBlobClient($"lookup-{lookupType}.json");

            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
            {
                WriteIndented = true
            });

            var bytes = Encoding.UTF8.GetBytes(json);

            using var stream = new MemoryStream(bytes);
            await blobClient.UploadAsync(stream, overwrite: true);

            _logger.LogDebug("Saved lookup data {LookupType} to blob storage", lookupType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving lookup data {LookupType} to blob storage", lookupType);
        }
    }

    private async Task<DateTime?> GetLastSyncTimeFromBlobAsync(BlobContainerClient containerClient)
    {
        try
        {
            var blobClient = containerClient.GetBlobClient("last-sync.txt");

            if (!await blobClient.ExistsAsync())
            {
                return null;
            }

            var response = await blobClient.DownloadContentAsync();
            var content = response.Value.Content.ToString();

            // Support both old format (just timestamp) and new format (timestamp|syncType|count)
            var parts = content.Split('|');
            if (DateTime.TryParse(parts[0], out var lastSync))
            {
                return lastSync;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error reading last sync time");
            return null;
        }
    }

    /// <summary>
    /// Save last successful page number for resume functionality
    /// </summary>
    private async Task SaveLastSuccessfulPageAsync(int platformId, int page)
    {
        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            await containerClient.CreateIfNotExistsAsync();
            
            var blobClient = containerClient.GetBlobClient($"last-page-platform-{platformId}.txt");
            var content = $"{page}|{DateTime.UtcNow:o}";
            var bytes = Encoding.UTF8.GetBytes(content);

            using var stream = new MemoryStream(bytes);
            await blobClient.UploadAsync(stream, overwrite: true);

            _logger.LogDebug("Saved last successful page {Page} for platform {PlatformId}", page, platformId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error saving last successful page for platform {PlatformId}", platformId);
        }
    }

    /// <summary>
    /// Get last successful page number for a platform
    /// </summary>
    public async Task<int?> GetLastSuccessfulPageAsync(int platformId)
    {
        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blobClient = containerClient.GetBlobClient($"last-page-platform-{platformId}.txt");

            if (!await blobClient.ExistsAsync())
            {
                return null;
            }

            var response = await blobClient.DownloadContentAsync();
            var content = response.Value.Content.ToString();
            var parts = content.Split('|');
            
            if (int.TryParse(parts[0], out var page))
            {
                return page;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error reading last successful page for platform {PlatformId}", platformId);
            return null;
        }
    }

    private async Task SaveLastSyncTimeToBlobAsync(BlobContainerClient containerClient, string syncType = "full", int gamesSynced = 0)
    {
        try
        {
            var blobClient = containerClient.GetBlobClient("last-sync.txt");
            var content = $"{DateTime.UtcNow:o}|{syncType}|{gamesSynced}";
            var bytes = Encoding.UTF8.GetBytes(content);

            using var stream = new MemoryStream(bytes);
            await blobClient.UploadAsync(stream, overwrite: true);

            _logger.LogDebug("Saved last sync time to blob: {SyncType}, {GamesSynced} games", syncType, gamesSynced);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving last sync time");
        }
    }

    /// <summary>
    /// Get sync statistics from blob storage
    /// </summary>
    /// <summary>
    /// Get sync statistics from blob storage or SQL database
    /// </summary>
    public async Task<SyncStatistics> GetStatisticsAsync()
    {
        switch (_storageMode)
        {
            case StorageMode.Blob:
                var blobStats = await GetBlobStatisticsAsync();
                blobStats.StorageMode = StorageMode.Blob;
                return blobStats;

            case StorageMode.SqlDatabase:
                var sqlStats = await GetSqlStatisticsAsync();
                sqlStats.StorageMode = StorageMode.SqlDatabase;
                return sqlStats;

            case StorageMode.Dual:
                // Get stats from both sources for comparison
                var blobStatsForDual = await GetBlobStatisticsAsync();
                var sqlStatsForDual = await GetSqlStatisticsAsync();
                
                var dualStats = new SyncStatistics
                {
                    StorageMode = StorageMode.Dual,
                    LastSyncTime = sqlStatsForDual.LastSyncTime ?? blobStatsForDual.LastSyncTime,
                    
                    // Primary counts (SQL as primary in Dual mode)
                    TotalGamesCached = sqlStatsForDual.TotalGamesCached,
                    GenreCount = sqlStatsForDual.GenreCount,
                    DeveloperCount = sqlStatsForDual.DeveloperCount,
                    PublisherCount = sqlStatsForDual.PublisherCount,
                    HasGenres = sqlStatsForDual.HasGenres,
                    HasDevelopers = sqlStatsForDual.HasDevelopers,
                    HasPublishers = sqlStatsForDual.HasPublishers,
                    
                    // Blob counts
                    BlobGameCount = blobStatsForDual.TotalGamesCached,
                    BlobGenreCount = blobStatsForDual.GenreCount,
                    BlobDeveloperCount = blobStatsForDual.DeveloperCount,
                    BlobPublisherCount = blobStatsForDual.PublisherCount,
                    
                    // SQL counts
                    SqlGameCount = sqlStatsForDual.TotalGamesCached,
                    SqlGenreCount = sqlStatsForDual.GenreCount,
                    SqlDeveloperCount = sqlStatsForDual.DeveloperCount,
                    SqlPublisherCount = sqlStatsForDual.PublisherCount
                };
                return dualStats;

            default:
                return new SyncStatistics { StorageMode = _storageMode };
        }
    }

    /// <summary>
    /// Get statistics from blob storage (legacy blob-specific implementation)
    /// </summary>
    private async Task<SyncStatistics> GetBlobStatisticsAsync()
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);

        if (!await containerClient.ExistsAsync())
        {
            return new SyncStatistics();
        }

        var stats = new SyncStatistics
        {
            LastSyncTime = await GetLastSyncTimeFromBlobAsync(containerClient)
        };

        // Count game blobs
        await foreach (var blob in containerClient.GetBlobsAsync(BlobTraits.None, BlobStates.None, prefix: "game-", cancellationToken: default))
        {
            stats.TotalGamesCached++;
        }

        // Check lookup data and get counts
        var genreBlob = containerClient.GetBlobClient("lookup-genres.json");
        stats.HasGenres = await genreBlob.ExistsAsync();
        if (stats.HasGenres)
        {
            var genreContent = await genreBlob.DownloadContentAsync();
            var genreDoc = JsonDocument.Parse(genreContent.Value.Content);
            if (genreDoc.RootElement.TryGetProperty("data", out var dataRoot) &&
                dataRoot.TryGetProperty("genres", out var genreItems) &&
                genreItems.ValueKind == JsonValueKind.Object)
            {
                stats.GenreCount = genreItems.EnumerateObject().Count();
            }
        }

        var developerBlob = containerClient.GetBlobClient("lookup-developers.json");
        stats.HasDevelopers = await developerBlob.ExistsAsync();
        if (stats.HasDevelopers)
        {
            var developerContent = await developerBlob.DownloadContentAsync();
            var developerDoc = JsonDocument.Parse(developerContent.Value.Content);
            if (developerDoc.RootElement.TryGetProperty("data", out var dataRoot) &&
                dataRoot.TryGetProperty("developers", out var developerItems) &&
                developerItems.ValueKind == JsonValueKind.Object)
            {
                stats.DeveloperCount = developerItems.EnumerateObject().Count();
            }
        }

        var publisherBlob = containerClient.GetBlobClient("lookup-publishers.json");
        stats.HasPublishers = await publisherBlob.ExistsAsync();
        if (stats.HasPublishers)
        {
            var publisherContent = await publisherBlob.DownloadContentAsync();
            var publisherDoc = JsonDocument.Parse(publisherContent.Value.Content);
            if (publisherDoc.RootElement.TryGetProperty("data", out var dataRoot) &&
                dataRoot.TryGetProperty("publishers", out var publisherItems) &&
                publisherItems.ValueKind == JsonValueKind.Object)
            {
                stats.PublisherCount = publisherItems.EnumerateObject().Count();
            }
        }

        return stats;
    }
}

public class SyncStatistics
{
    public DateTime? LastSyncTime { get; set; }
    public int TotalGamesCached { get; set; }
    public bool HasGenres { get; set; }
    public bool HasDevelopers { get; set; }
    public bool HasPublishers { get; set; }
    public int GenreCount { get; set; }
    public int DeveloperCount { get; set; }
    public int PublisherCount { get; set; }
    public StorageMode StorageMode { get; set; }
    
    // Dual mode: Separate counts for blob and SQL
    public int? BlobGameCount { get; set; }
    public int? SqlGameCount { get; set; }
    public int? BlobGenreCount { get; set; }
    public int? SqlGenreCount { get; set; }
    public int? BlobDeveloperCount { get; set; }
    public int? SqlDeveloperCount { get; set; }
    public int? BlobPublisherCount { get; set; }
    public int? SqlPublisherCount { get; set; }
}
