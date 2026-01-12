using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;

namespace GameSyncTool;

public class GameSyncService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly string _containerName;
    private readonly ILogger<GameSyncService> _logger;
    private readonly int _switchPlatformId;
    private readonly int _switch2PlatformId;
    private const string ApiBaseUrl = "https://api.thegamesdb.net/v1";

    public GameSyncService(
        HttpClient httpClient,
        TheGamesDBSettings gamesDbSettings,
        BlobStorageSettings blobSettings,
        PlatformsSettings platformSettings,
        ILogger<GameSyncService> logger)
    {
        _httpClient = httpClient;
        _apiKey = gamesDbSettings.ApiKey;
        _blobServiceClient = new BlobServiceClient(blobSettings.ConnectionString);
        _containerName = blobSettings.ContainerName;
        _logger = logger;
        _switchPlatformId = platformSettings.NintendoSwitch;
        _switch2PlatformId = platformSettings.NintendoSwitch2;
    }

    /// <summary>
    /// Sync all games for Nintendo Switch and Switch 2 platforms
    /// </summary>
    public async Task SyncAllGamesAsync()
    {
        _logger.LogInformation("Starting full sync for all Switch and Switch 2 games...");

        // Ensure container exists
        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
        await containerClient.CreateIfNotExistsAsync();

        // Sync both platforms
        await SyncPlatformGamesAsync(_switchPlatformId, "Nintendo Switch");
        await SyncPlatformGamesAsync(_switch2PlatformId, "Nintendo Switch 2");

        // Sync lookup data (genres, developers, publishers)
        await SyncLookupDataAsync();

        _logger.LogInformation("Full sync completed successfully!");
    }

    /// <summary>
    /// Sync only games that have been updated since the last sync
    /// </summary>
    public async Task SyncUpdatesAsync()
    {
        _logger.LogInformation("Starting incremental sync for updated games...");

        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
        await containerClient.CreateIfNotExistsAsync();

        // Get the last sync timestamp
        var lastSyncTime = await GetLastSyncTimeAsync(containerClient);
        _logger.LogInformation("Last sync was at: {LastSyncTime}", lastSyncTime);

        // Sync updates for both platforms
        await SyncPlatformUpdatesAsync(_switchPlatformId, "Nintendo Switch", lastSyncTime);
        await SyncPlatformUpdatesAsync(_switch2PlatformId, "Nintendo Switch 2", lastSyncTime);

        // Update the last sync timestamp
        await SaveLastSyncTimeAsync(containerClient);

        _logger.LogInformation("Incremental sync completed successfully!");
    }

    private async Task SyncPlatformGamesAsync(int platformId, string platformName)
    {
        _logger.LogInformation("Syncing all games for {Platform} (ID: {PlatformId})...", platformName, platformId);

        try
        {
            var page = 1;
            var totalSynced = 0;

            while (true)
            {
                _logger.LogInformation("Fetching page {Page} for {Platform}...", page, platformName);

                // Fetch games by platform with pagination
                var url = $"{ApiBaseUrl}/Games/ByPlatformID?apikey={_apiKey}&id={platformId}&page={page}";
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("API request failed: {StatusCode}", response.StatusCode);
                    break;
                }

                var content = await response.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(content);

                // Check if there are games in the response
                if (!jsonDoc.RootElement.TryGetProperty("data", out var data) ||
                    !data.TryGetProperty("games", out var gamesArray) ||
                    gamesArray.GetArrayLength() == 0)
                {
                    _logger.LogInformation("No more games found for {Platform}", platformName);
                    break;
                }

                _logger.LogInformation("Retrieved {Count} games from page {Page}", gamesArray.GetArrayLength(), page);

                // Save each game to blob storage
                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                foreach (var game in gamesArray.EnumerateArray())
                {
                    if (game.TryGetProperty("id", out var idProp))
                    {
                        var gameId = idProp.GetInt32();
                        await SaveGameToBlobAsync(containerClient, gameId, jsonDoc.RootElement);
                        totalSynced++;
                    }
                }

                _logger.LogInformation("Synced {Total} games so far for {Platform}", totalSynced, platformName);

                // Check if there are more pages
                if (!jsonDoc.RootElement.TryGetProperty("pages", out var pages) ||
                    !pages.TryGetProperty("next", out var nextPage) ||
                    nextPage.ValueKind == JsonValueKind.Null)
                {
                    _logger.LogInformation("No more pages available for {Platform}", platformName);
                    break;
                }

                page++;

                // Add a small delay to avoid rate limiting
                await Task.Delay(500);
            }

            _logger.LogInformation("Completed syncing {Total} games for {Platform}", totalSynced, platformName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing games for {Platform}", platformName);
            throw;
        }
    }

    private async Task SyncPlatformUpdatesAsync(int platformId, string platformName, DateTime? since)
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

                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                var gamesProcessed = 0;

                foreach (var game in gamesArray.EnumerateArray())
                {
                    if (!game.TryGetProperty("id", out var idProp))
                        continue;

                    var gameId = idProp.GetInt32();

                    // Check if game needs updating
                    if (since.HasValue)
                    {
                        var existingGame = await GetGameFromBlobAsync(containerClient, gameId);
                        if (existingGame != null)
                        {
                            // Game exists, skip if not updated
                            continue;
                        }
                    }

                    await SaveGameToBlobAsync(containerClient, gameId, jsonDoc.RootElement);
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
                await Task.Delay(500);
            }

            _logger.LogInformation("Completed syncing {Total} updates for {Platform}", totalSynced, platformName);
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

        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);

        try
        {
            // Sync Genres
            _logger.LogInformation("Syncing Genres...");
            var genresUrl = $"{ApiBaseUrl}/Genres?apikey={_apiKey}";
            var genresResponse = await _httpClient.GetAsync(genresUrl);
            if (genresResponse.IsSuccessStatusCode)
            {
                var content = await genresResponse.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(content);
                await SaveLookupDataToBlobAsync(containerClient, "genres", jsonDoc.RootElement);
                
                if (jsonDoc.RootElement.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("genres", out var genres))
                {
                    _logger.LogInformation("Synced {Count} genres", genres.GetArrayLength());
                }
            }

            // Sync Developers
            _logger.LogInformation("Syncing Developers...");
            var developersUrl = $"{ApiBaseUrl}/Developers?apikey={_apiKey}";
            var developersResponse = await _httpClient.GetAsync(developersUrl);
            if (developersResponse.IsSuccessStatusCode)
            {
                var content = await developersResponse.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(content);
                await SaveLookupDataToBlobAsync(containerClient, "developers", jsonDoc.RootElement);
                
                if (jsonDoc.RootElement.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("developers", out var developers))
                {
                    _logger.LogInformation("Synced {Count} developers", developers.GetArrayLength());
                }
            }

            // Sync Publishers
            _logger.LogInformation("Syncing Publishers...");
            var publishersUrl = $"{ApiBaseUrl}/Publishers?apikey={_apiKey}";
            var publishersResponse = await _httpClient.GetAsync(publishersUrl);
            if (publishersResponse.IsSuccessStatusCode)
            {
                var content = await publishersResponse.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(content);
                await SaveLookupDataToBlobAsync(containerClient, "publishers", jsonDoc.RootElement);
                
                if (jsonDoc.RootElement.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("publishers", out var publishers))
                {
                    _logger.LogInformation("Synced {Count} publishers", publishers.GetArrayLength());
                }
            }

            _logger.LogInformation("Completed syncing lookup data");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing lookup data");
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

    private async Task<DateTime?> GetLastSyncTimeAsync(BlobContainerClient containerClient)
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

            if (DateTime.TryParse(content, out var lastSync))
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

    private async Task SaveLastSyncTimeAsync(BlobContainerClient containerClient)
    {
        try
        {
            var blobClient = containerClient.GetBlobClient("last-sync.txt");
            var content = DateTime.UtcNow.ToString("o");
            var bytes = Encoding.UTF8.GetBytes(content);

            using var stream = new MemoryStream(bytes);
            await blobClient.UploadAsync(stream, overwrite: true);

            _logger.LogDebug("Saved last sync time");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving last sync time");
        }
    }

    /// <summary>
    /// Get sync statistics from blob storage
    /// </summary>
    public async Task<SyncStatistics> GetStatisticsAsync()
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);

        if (!await containerClient.ExistsAsync())
        {
            return new SyncStatistics();
        }

        var stats = new SyncStatistics
        {
            LastSyncTime = await GetLastSyncTimeAsync(containerClient)
        };

        // Count game blobs
        await foreach (var blob in containerClient.GetBlobsAsync(BlobTraits.None, BlobStates.None, prefix: "game-", cancellationToken: default))
        {
            stats.TotalGamesCached++;
        }

        // Check lookup data
        var genreBlob = containerClient.GetBlobClient("lookup-genres.json");
        stats.HasGenres = await genreBlob.ExistsAsync();

        var developerBlob = containerClient.GetBlobClient("lookup-developers.json");
        stats.HasDevelopers = await developerBlob.ExistsAsync();

        var publisherBlob = containerClient.GetBlobClient("lookup-publishers.json");
        stats.HasPublishers = await publisherBlob.ExistsAsync();

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
}
