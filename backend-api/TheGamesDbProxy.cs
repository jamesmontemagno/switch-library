using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Web;

namespace SwitchLibraryApi;

/// <summary>
/// Azure Function to proxy requests to TheGamesDB API
/// This solves CORS issues by making API calls from the server side
/// </summary>
public class TheGamesDbProxy
{
    private readonly ILogger<TheGamesDbProxy> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string? _apiKey;
    private readonly string? _blobConnectionString;
    private readonly string _containerName;
    private const string ApiBaseUrl = "https://api.thegamesdb.net/v1";

    public TheGamesDbProxy(ILogger<TheGamesDbProxy> logger, IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _apiKey = configuration["TheGamesDB:ApiKey"];
        _blobConnectionString = configuration["BlobStorage:ConnectionString"];
        _containerName = configuration["BlobStorage:ContainerName"] ?? "games-cache";
    }

    /// <summary>
    /// Proxy endpoint for TheGamesDB API requests
    /// Route: /api/thegamesdb/{*path} where path is the API endpoint like Games/ByGameName
    /// </summary>
    [Function("TheGamesDbProxy")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "thegamesdb/{*path}")] HttpRequest req,
        string path)
    {
        _logger.LogInformation("Proxying request to TheGamesDB API for path: {Path}", path);

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

            // Build the target URL with API key
            var queryString = req.QueryString.HasValue ? req.QueryString.Value : string.Empty;
            
            // Add API key to query string
            var separator = queryString.Contains('?') ? "&" : "?";
            var targetUrl = $"{ApiBaseUrl}/{path}{queryString}{separator}apikey={_apiKey}";
            
            _logger.LogInformation("Target URL: {TargetUrl}", targetUrl.Replace(_apiKey, "***"));

            // Create HTTP client and make the request
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.DefaultRequestHeaders.Add("User-Agent", "MySwitchLibrary/1.0");

            var response = await httpClient.GetAsync(targetUrl);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("TheGamesDB API error: {StatusCode} {ReasonPhrase}", 
                    response.StatusCode, response.ReasonPhrase);
                
                return new ObjectResult(new
                {
                    error = $"TheGamesDB API error: {(int)response.StatusCode} {response.ReasonPhrase}"
                })
                {
                    StatusCode = (int)response.StatusCode
                };
            }

            // Read the response content
            var content = await response.Content.ReadAsStringAsync();
            
            // Parse and return as JSON
            var jsonDocument = JsonDocument.Parse(content);
            
            // Transform the response to strip API keys from pagination URLs
            var transformedResponse = TransformPaginationUrls(jsonDocument.RootElement, req);
            
            // If this is a search result with games, cache them in blob storage (fire-and-forget)
            // This runs in the background and doesn't block the response
            if (path.StartsWith("Games/ByGameName", StringComparison.OrdinalIgnoreCase))
            {
                _ = CacheSearchResultsInBackgroundAsync(jsonDocument.RootElement);
            }
            
            return new OkObjectResult(transformedResponse)
            {
                StatusCode = 200,
                // Add caching headers
                ContentTypes = { "application/json" }
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP request failed while proxying to TheGamesDB API");
            return new ObjectResult(new
            {
                error = "Failed to proxy request",
                message = ex.Message
            })
            {
                StatusCode = (int)HttpStatusCode.BadGateway
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while proxying to TheGamesDB API");
            return new ObjectResult(new
            {
                error = "Failed to proxy request",
                message = ex.Message
            })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    /// <summary>
    /// Transform pagination URLs to strip API keys and convert to backend URLs
    /// </summary>
    private JsonElement TransformPaginationUrls(JsonElement responseData, HttpRequest req)
    {
        try
        {
            using var stream = new MemoryStream();
            using var writer = new Utf8JsonWriter(stream);
            
            writer.WriteStartObject();
            
            // Copy all properties from the original response
            foreach (var property in responseData.EnumerateObject())
            {
                if (property.Name == "pages")
                {
                    // Transform the pages object
                    writer.WritePropertyName("pages");
                    writer.WriteStartObject();
                    
                    foreach (var pageProperty in property.Value.EnumerateObject())
                    {
                        writer.WritePropertyName(pageProperty.Name);
                        
                        if (pageProperty.Value.ValueKind == JsonValueKind.Null)
                        {
                            writer.WriteNullValue();
                        }
                        else if (pageProperty.Value.ValueKind == JsonValueKind.String)
                        {
                            var originalUrl = pageProperty.Value.GetString();
                            if (!string.IsNullOrEmpty(originalUrl))
                            {
                                var transformedUrl = ConvertToBackendUrl(originalUrl, req);
                                writer.WriteStringValue(transformedUrl);
                            }
                            else
                            {
                                writer.WriteNullValue();
                            }
                        }
                        else
                        {
                            pageProperty.Value.WriteTo(writer);
                        }
                    }
                    
                    writer.WriteEndObject();
                }
                else
                {
                    // Copy other properties as-is
                    writer.WritePropertyName(property.Name);
                    property.Value.WriteTo(writer);
                }
            }
            
            writer.WriteEndObject();
            writer.Flush();
            
            stream.Position = 0;
            return JsonDocument.Parse(stream).RootElement;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error transforming pagination URLs, returning original response");
            return responseData;
        }
    }

    /// <summary>
    /// Convert TheGamesDB API URL to backend URL and strip API key
    /// Example: https://api.thegamesdb.net/v1/Games/ByGameName?name=mario&apikey=xxx&page=2
    /// Becomes: /api/thegamesdb/Games/ByGameName?name=mario&page=2
    /// </summary>
    private string ConvertToBackendUrl(string originalUrl, HttpRequest req)
    {
        try
        {
            var uri = new Uri(originalUrl);
            
            // Extract the path after /v1/
            var pathStartIndex = uri.AbsolutePath.IndexOf("/v1/", StringComparison.OrdinalIgnoreCase);
            if (pathStartIndex == -1)
            {
                return originalUrl; // Couldn't parse, return original
            }
            
            var apiPath = uri.AbsolutePath.Substring(pathStartIndex + 4); // Skip "/v1/"
            
            // Parse query string and remove apikey parameter
            var queryParams = System.Web.HttpUtility.ParseQueryString(uri.Query);
            queryParams.Remove("apikey");
            
            // Build the new query string
            var newQuery = queryParams.Count > 0 ? "?" + queryParams.ToString() : string.Empty;
            
            // Get the backend base URL from the request
            var scheme = req.Scheme;
            var host = req.Host.Value;
            
            // Build the backend URL
            var backendUrl = $"{scheme}://{host}/api/thegamesdb/{apiPath}{newQuery}";
            
            return backendUrl;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error converting URL to backend format: {OriginalUrl}", originalUrl);
            return originalUrl; // Return original on error
        }
    }

    /// <summary>
    /// Wrapper to ensure caching runs in the background without blocking the response
    /// </summary>
    private async Task CacheSearchResultsInBackgroundAsync(JsonElement responseData)
    {
        try
        {
            // Run on thread pool to avoid blocking
            await Task.Yield();
            await CacheSearchResultsAsync(responseData);
        }
        catch (Exception ex)
        {
            // Log errors but don't propagate since this is fire-and-forget
            _logger.LogError(ex, "Background caching failed");
        }
    }

    private async Task CacheSearchResultsAsync(JsonElement responseData)
    {
        if (string.IsNullOrWhiteSpace(_blobConnectionString))
        {
            return;
        }

        // Extract games from the response
        if (!responseData.TryGetProperty("data", out var data) ||
            !data.TryGetProperty("games", out var gamesArray))
        {
            return;
        }

        var blobServiceClient = new BlobServiceClient(_blobConnectionString);
        var containerClient = blobServiceClient.GetBlobContainerClient(_containerName);
        
        // Ensure container exists
        await containerClient.CreateIfNotExistsAsync();

        // Cache all games concurrently (no artificial throttling)
        var cacheTasks = new List<Task>();
        
        foreach (var game in gamesArray.EnumerateArray())
        {
            if (game.TryGetProperty("id", out var idProperty))
            {
                var gameId = idProperty.GetInt32();
                cacheTasks.Add(SaveGameToBlobAsync(containerClient, gameId, responseData));
            }
        }
        
        // Wait for all caching operations to complete
        await Task.WhenAll(cacheTasks);
        
        _logger.LogInformation("Cached {Count} games from search results", gamesArray.GetArrayLength());
    }

    private async Task SaveGameToBlobAsync(BlobContainerClient containerClient, int gameId, JsonElement fullResponse)
    {
        try
        {
            var blobClient = containerClient.GetBlobClient($"game-{gameId}.json");
            
            var json = JsonSerializer.Serialize(fullResponse, new JsonSerializerOptions 
            { 
                WriteIndented = true 
            });
            
            var bytes = Encoding.UTF8.GetBytes(json);
            
            using var stream = new MemoryStream(bytes);
            await blobClient.UploadAsync(stream, overwrite: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving game {GameId} to blob storage", gameId);
        }
    }
}

