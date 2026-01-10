using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
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
/// Azure Function to get game details by ID with blob storage caching
/// First checks blob storage, then falls back to TheGamesDB API if not found
/// </summary>
public class GetGameById
{
    private readonly ILogger<GetGameById> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string? _apiKey;
    private readonly string? _blobConnectionString;
    private readonly string _containerName;
    private const string ApiBaseUrl = "https://api.thegamesdb.net/v1";

    public GetGameById(
        ILogger<GetGameById> logger, 
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
    /// Get game details by ID with caching
    /// Route: /api/games/{gameId}
    /// </summary>
    [Function("GetGameById")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "games/{gameId}")] HttpRequest req,
        int gameId)
    {
        _logger.LogInformation("Getting game details for ID: {GameId}", gameId);

        try
        {
            // Check if API key is configured
            if (string.IsNullOrWhiteSpace(_apiKey))
            {
                _logger.LogError("TheGamesDB API key is not configured");
                return new ObjectResult(new
                {
                    error = "TheGamesDB API key is not configured in the server"
                })
                {
                    StatusCode = (int)HttpStatusCode.InternalServerError
                };
            }

            // Try to get from blob storage first
            var cachedGame = await GetFromBlobStorageAsync(gameId);
            if (cachedGame != null)
            {
                _logger.LogInformation("Game {GameId} found in cache", gameId);
                return new OkObjectResult(cachedGame)
                {
                    StatusCode = 200
                };
            }

            // Not in cache, call TheGamesDB API
            _logger.LogInformation("Game {GameId} not in cache, fetching from API", gameId);
            var gameData = await FetchFromApiAsync(gameId);
            
            if (!gameData.HasValue)
            {
                return new NotFoundObjectResult(new
                {
                    error = $"Game with ID {gameId} not found"
                });
            }

            // Store in blob storage for future requests
            await SaveToBlobStorageAsync(gameId, gameData.Value);

            return new OkObjectResult(gameData.Value)
            {
                StatusCode = 200
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting game details for ID: {GameId}", gameId);
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
                _logger.LogWarning("Blob storage connection string not configured, skipping cache");
                return null;
            }

            var blobServiceClient = new BlobServiceClient(_blobConnectionString);
            var containerClient = blobServiceClient.GetBlobContainerClient(_containerName);
            
            // Create container if it doesn't exist (for local development)
            await containerClient.CreateIfNotExistsAsync();

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
            // Build the API URL with all fields
            var queryParams = new Dictionary<string, string>
            {
                { "apikey", _apiKey! },
                { "id", gameId.ToString() },
                { "fields", "players,publishers,genres,overview,last_updated,rating,platform,coop,youtube,os,processor,ram,hdd,video,sound,alternates" },
                { "include", "boxart,platform" }
            };

            var queryString = string.Join("&", queryParams.Select(kvp => $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));
            var targetUrl = $"{ApiBaseUrl}/Games/ByGameID?{queryString}";

            _logger.LogInformation("Calling TheGamesDB API for game {GameId}", gameId);

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.DefaultRequestHeaders.Add("User-Agent", "MySwitchLibrary/1.0");

            var response = await httpClient.GetAsync(targetUrl);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("TheGamesDB API error: {StatusCode} {ReasonPhrase}", 
                    response.StatusCode, response.ReasonPhrase);
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
                _logger.LogWarning("Blob storage connection string not configured, skipping cache save");
                return;
            }

            var blobServiceClient = new BlobServiceClient(_blobConnectionString);
            var containerClient = blobServiceClient.GetBlobContainerClient(_containerName);
            
            // Ensure container exists
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
            // Don't throw - cache save failure shouldn't break the request
        }
    }
}
