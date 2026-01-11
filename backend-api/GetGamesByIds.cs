using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text;
using System.Text.Json;

namespace SwitchLibraryApi;

/// <summary>
/// Azure Function to get multiple game details by IDs with blob storage caching
/// Primarily fetches from blob storage only (no API calls) for trending feature
/// </summary>
public class GetGamesByIds
{
    private readonly ILogger<GetGamesByIds> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string? _apiKey;
    private readonly string? _blobConnectionString;
    private readonly string _containerName;
    private const string ApiBaseUrl = "https://api.thegamesdb.net/v1";
    private const int MaxBatchSize = 50;

    public GetGamesByIds(
        ILogger<GetGamesByIds> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _apiKey = configuration["TheGamesDB:ApiKey"];
        _blobConnectionString = configuration["ProductionStorage"];
        _containerName = configuration["BlobStorage:ContainerName"] ?? "games-cache";
    }

    /// <summary>
    /// Get multiple game details by IDs with caching
    /// Route: POST /api/games/bulk
    /// Body: { "ids": [123, 456, ...], "includeUncached": false }
    /// </summary>
    [Function("GetGamesByIds")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "games/bulk")] HttpRequest req)
    {
        _logger.LogInformation("Getting bulk game details");

        try
        {
            // Parse request body
            using var reader = new StreamReader(req.Body);
            var body = await reader.ReadToEndAsync();
            var request = JsonSerializer.Deserialize<BulkGameRequest>(body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (request?.Ids == null || request.Ids.Length == 0)
            {
                return new BadRequestObjectResult(new
                {
                    error = "Request body must contain an 'ids' array"
                });
            }

            // Limit batch size
            var ids = request.Ids.Take(MaxBatchSize).Distinct().ToArray();
            _logger.LogInformation("Processing {Count} game IDs", ids.Length);

            var found = new List<JsonElement>();
            var notFound = new List<int>();

            // Try to get all games from blob storage first
            var blobTasks = ids.Select(async id =>
            {
                var cached = await GetFromBlobStorageAsync(id);
                return (id, cached);
            });

            var blobResults = await Task.WhenAll(blobTasks);

            foreach (var (id, cached) in blobResults)
            {
                if (cached.HasValue)
                {
                    found.Add(cached.Value);
                }
                else
                {
                    notFound.Add(id);
                }
            }

            _logger.LogInformation("Found {FoundCount} in cache, {NotFoundCount} not found",
                found.Count, notFound.Count);

            // If includeUncached is true and API key is configured, fetch missing games from API
            if (request.IncludeUncached && notFound.Count > 0 && !string.IsNullOrWhiteSpace(_apiKey))
            {
                _logger.LogInformation("Fetching {Count} uncached games from API", notFound.Count);

                var apiTasks = notFound.Select(async id =>
                {
                    var gameData = await FetchFromApiAsync(id);
                    if (gameData.HasValue)
                    {
                        // Save to blob storage in background
                        _ = SaveToBlobStorageAsync(id, gameData.Value);
                    }
                    return (id, gameData);
                });

                var apiResults = await Task.WhenAll(apiTasks);

                var stillNotFound = new List<int>();
                foreach (var (id, gameData) in apiResults)
                {
                    if (gameData.HasValue)
                    {
                        found.Add(gameData.Value);
                    }
                    else
                    {
                        stillNotFound.Add(id);
                    }
                }

                notFound = stillNotFound;
            }

            return new OkObjectResult(new
            {
                found = found,
                notFound = notFound,
                totalRequested = ids.Length,
                foundCount = found.Count,
                notFoundCount = notFound.Count
            });
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Invalid JSON in request body");
            return new BadRequestObjectResult(new
            {
                error = "Invalid JSON in request body",
                message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting bulk game details");
            return new ObjectResult(new
            {
                error = "Failed to get game details",
                message = ex.Message
            })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    private async Task<JsonElement?> GetFromBlobStorageAsync(int gameId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_blobConnectionString))
            {
                return null;
            }

            var blobServiceClient = new BlobServiceClient(_blobConnectionString);
            var containerClient = blobServiceClient.GetBlobContainerClient(_containerName);

            var blobClient = containerClient.GetBlobClient($"game-{gameId}.json");

            if (!await blobClient.ExistsAsync())
            {
                return null;
            }

            var response = await blobClient.DownloadContentAsync();
            var json = response.Value.Content.ToString();
            var jsonDoc = JsonDocument.Parse(json);

            return jsonDoc.RootElement;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading from blob storage for game {GameId}", gameId);
            return null;
        }
    }

    private async Task<JsonElement?> FetchFromApiAsync(int gameId)
    {
        try
        {
            var queryParams = new Dictionary<string, string>
            {
                { "apikey", _apiKey! },
                { "id", gameId.ToString() },
                { "fields", "players,publishers,genres,overview,last_updated,rating,platform,coop,youtube,os,processor,ram,hdd,video,sound,alternates" },
                { "include", "boxart,platform" }
            };

            var queryString = string.Join("&", queryParams.Select(kvp => $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));
            var targetUrl = $"{ApiBaseUrl}/Games/ByGameID?{queryString}";

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.DefaultRequestHeaders.Add("User-Agent", "MySwitchLibrary/1.0");

            var response = await httpClient.GetAsync(targetUrl);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("TheGamesDB API error for game {GameId}: {StatusCode}",
                    gameId, response.StatusCode);
                return null;
            }

            var content = await response.Content.ReadAsStringAsync();
            var jsonDocument = JsonDocument.Parse(content);

            return jsonDocument.RootElement;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching game {GameId} from API", gameId);
            return null;
        }
    }

    private async Task SaveToBlobStorageAsync(int gameId, JsonElement gameData)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_blobConnectionString))
            {
                return;
            }

            var blobServiceClient = new BlobServiceClient(_blobConnectionString);
            var containerClient = blobServiceClient.GetBlobContainerClient(_containerName);

            await containerClient.CreateIfNotExistsAsync();

            var blobClient = containerClient.GetBlobClient($"game-{gameId}.json");

            var json = JsonSerializer.Serialize(gameData, new JsonSerializerOptions
            {
                WriteIndented = true
            });

            var bytes = Encoding.UTF8.GetBytes(json);

            using var stream = new MemoryStream(bytes);
            await blobClient.UploadAsync(stream, overwrite: true);

            _logger.LogInformation("Game {GameId} saved to blob storage", gameId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving game {GameId} to blob storage", gameId);
        }
    }

    private class BulkGameRequest
    {
        public int[] Ids { get; set; } = Array.Empty<int>();
        public bool IncludeUncached { get; set; } = false;
    }
}
