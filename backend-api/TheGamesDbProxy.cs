using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text.Json;

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
    private const string ApiBaseUrl = "https://api.thegamesdb.net/v1";

    public TheGamesDbProxy(ILogger<TheGamesDbProxy> logger, IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _apiKey = configuration["TheGamesDB:ApiKey"];
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
            
            return new OkObjectResult(jsonDocument.RootElement)
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
}
