using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text.Json;

namespace SwitchLibraryApi;

/// <summary>
/// Azure Functions for SQL database game queries.
/// These replace the TheGamesDB API proxy for all user-facing queries.
/// </summary>
public class SqlGameFunctions
{
    private readonly ILogger<SqlGameFunctions> _logger;
    private readonly SqlGameService _gameService;
    private readonly GameSync.Core.GameSyncService? _syncService;

    public SqlGameFunctions(ILogger<SqlGameFunctions> logger, SqlGameService gameService, GameSync.Core.GameSyncService? syncService = null)
    {
        _logger = logger;
        _gameService = gameService;
        _syncService = syncService;
    }

    /// <summary>
    /// Search games from SQL database with filters and pagination
    /// Route: GET /api/search
    /// Query params: query, platformId, genreIds, developerIds, publisherIds, releaseYear, coop, minPlayers, page, pageSize
    /// </summary>
    [Function("SearchGamesFromSql")]
    public async Task<IActionResult> SearchGames(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "search")] HttpRequest req)
    {
        try
        {
            // Parse query parameters
            var query = req.Query["query"].ToString();
            
            int? platformId = int.TryParse(req.Query["platformId"], out var pId) ? pId : null;
            int? releaseYear = int.TryParse(req.Query["releaseYear"], out var ry) ? ry : null;
            bool? coop = null;
            if (req.Query.TryGetValue("coop", out var coopValues))
            {
                var coopRaw = coopValues.ToString();
                if (!string.IsNullOrWhiteSpace(coopRaw))
                {
                    if (bool.TryParse(coopRaw, out var coopParsed))
                    {
                        coop = coopParsed;
                    }
                    else
                    {
                        return new BadRequestObjectResult(new
                        {
                            error = "InvalidParameter",
                            message = "The 'coop' query parameter must be 'true' or 'false'."
                        });
                    }
                }
            }
            int? minPlayers = int.TryParse(req.Query["minPlayers"], out var mp) ? mp : null;
            int page = int.TryParse(req.Query["page"], out var p) ? p : 1;
            int pageSize = int.TryParse(req.Query["pageSize"], out var ps) ? Math.Min(ps, 50) : 20;

            // Parse array parameters
            int[]? genreIds = ParseIntArray(req.Query["genreIds"]);
            int[]? developerIds = ParseIntArray(req.Query["developerIds"]);
            int[]? publisherIds = ParseIntArray(req.Query["publisherIds"]);

            _logger.LogInformation("SQL Search: query={Query}, platform={Platform}, page={Page}", 
                query, platformId, page);

            var result = await _gameService.SearchGamesAsync(
                query,
                platformId,
                genreIds,
                developerIds,
                publisherIds,
                releaseYear,
                coop,
                minPlayers,
                page,
                pageSize
            );

            return new OkObjectResult(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching games from SQL");
            return new ObjectResult(new { error = "Search failed", message = ex.Message })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    /// <summary>
    /// Get single game details by ID from SQL database
    /// Route: GET /api/games/{gameId}
    /// </summary>
    [Function("GetGameFromSql")]
    public async Task<IActionResult> GetGame(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "games/{gameId:int}")] HttpRequest req,
        int gameId)
    {
        try
        {
            _logger.LogInformation("SQL GetGame: gameId={GameId}", gameId);

            var game = await _gameService.GetGameByIdAsync(gameId);

            if (game == null)
            {
                return new NotFoundObjectResult(new { error = $"Game {gameId} not found" });
            }

            return new OkObjectResult(game);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting game {GameId} from SQL", gameId);
            return new ObjectResult(new { error = "Failed to get game", message = ex.Message })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    /// <summary>
    /// Get multiple games by IDs from SQL database
    /// Route: POST /api/games/bulk
    /// Body: { "ids": [123, 456, ...] }
    /// </summary>
    [Function("GetGamesFromSql")]
    public async Task<IActionResult> GetGamesBulk(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "games/bulk")] HttpRequest req)
    {
        try
        {
            using var reader = new StreamReader(req.Body);
            var body = await reader.ReadToEndAsync();
            var request = JsonSerializer.Deserialize<BulkIdsRequest>(body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (request?.Ids == null || request.Ids.Length == 0)
            {
                return new BadRequestObjectResult(new { error = "Request body must contain an 'ids' array" });
            }

            // Limit to 50 games per request
            var ids = request.Ids.Take(50).Distinct().ToArray();
            
            _logger.LogInformation("SQL GetGamesBulk: count={Count}", ids.Length);

            var games = await _gameService.GetGamesByIdsAsync(ids);
            var foundIds = games.Select(g => g.Id).ToHashSet();
            var notFoundIds = ids.Where(id => !foundIds.Contains(id)).ToArray();

            return new OkObjectResult(new
            {
                found = games,
                notFound = notFoundIds,
                foundCount = games.Count,
                notFoundCount = notFoundIds.Length
            });
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Invalid JSON in bulk request");
            return new BadRequestObjectResult(new { error = "Invalid JSON", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting bulk games from SQL");
            return new ObjectResult(new { error = "Bulk fetch failed", message = ex.Message })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    /// <summary>
    /// Get upcoming game releases from SQL database
    /// Route: GET /api/upcoming
    /// Query params: days (30/60/90), platformId, page, pageSize
    /// </summary>
    [Function("GetUpcomingGames")]
    public async Task<IActionResult> GetUpcomingGames(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "upcoming")] HttpRequest req)
    {
        try
        {
            int days = int.TryParse(req.Query["days"], out var d) ? d : 90;
            int? platformId = int.TryParse(req.Query["platformId"], out var pId) ? pId : null;
            int page = int.TryParse(req.Query["page"], out var p) ? p : 1;
            int pageSize = int.TryParse(req.Query["pageSize"], out var ps) ? Math.Min(ps, 50) : 20;

            // Limit days to reasonable range
            days = Math.Min(Math.Max(days, 7), 365);

            _logger.LogInformation("SQL GetUpcoming: days={Days}, platform={Platform}", days, platformId);

            var result = await _gameService.GetUpcomingGamesAsync(days, platformId, page, pageSize);

            return new OkObjectResult(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting upcoming games from SQL");
            return new ObjectResult(new { error = "Failed to get upcoming games", message = ex.Message })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    /// <summary>
    /// Get game recommendations based on a source game
    /// Route: GET /api/recommendations/{gameId}
    /// Query params: limit
    /// </summary>
    [Function("GetGameRecommendations")]
    public async Task<IActionResult> GetRecommendations(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "recommendations/{gameId:int}")] HttpRequest req,
        int gameId)
    {
        try
        {
            int limit = int.TryParse(req.Query["limit"], out var l) ? Math.Min(l, 20) : 10;

            _logger.LogInformation("SQL GetRecommendations: gameId={GameId}, limit={Limit}", gameId, limit);

            var recommendations = await _gameService.GetRecommendationsAsync(gameId, limit);

            return new OkObjectResult(new
            {
                sourceGameId = gameId,
                recommendations = recommendations,
                count = recommendations.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting recommendations for game {GameId}", gameId);
            return new ObjectResult(new { error = "Failed to get recommendations", message = ex.Message })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    /// <summary>
    /// Get lookup data (genres, developers, publishers) from SQL database
    /// Route: GET /api/lookup/{type}
    /// </summary>
    [Function("GetLookupData")]
    public async Task<IActionResult> GetLookupData(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lookup/{type}")] HttpRequest req,
        string type)
    {
        try
        {
            _logger.LogInformation("SQL GetLookup: type={Type}", type);

            object result = type.ToLowerInvariant() switch
            {
                "genres" => await _gameService.GetGenresAsync(),
                "developers" => await _gameService.GetDevelopersAsync(),
                "publishers" => await _gameService.GetPublishersAsync(),
                _ => throw new ArgumentException($"Unknown lookup type: {type}")
            };

            // Add cache headers for lookup data (7 days = 604800 seconds)
            req.HttpContext.Response.Headers["Cache-Control"] = "public, max-age=604800, immutable";
            req.HttpContext.Response.Headers["Vary"] = "Accept-Encoding";
            
            var response = new OkObjectResult(new { data = result });
            return response;
        }
        catch (ArgumentException ex)
        {
            return new BadRequestObjectResult(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting lookup data for type {Type}", type);
            return new ObjectResult(new { error = "Failed to get lookup data", message = ex.Message })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    /// <summary>
    /// Get database statistics (Admin only - requires function key)
    /// Route: GET /api/admin/database-stats
    /// </summary>
    [Function("GetDatabaseStatsAdmin")]
    public async Task<IActionResult> GetDatabaseStatsAdmin(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "admin/database-stats")] HttpRequest req)
    {
        try
        {
            var stats = await _gameService.GetStatsAsync();
            return new OkObjectResult(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting database stats");
            return new ObjectResult(new { error = "Failed to get database stats", message = ex.Message })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    /// <summary>
    /// Get database statistics (Public - for backward compatibility, kept anonymous)
    /// Route: GET /api/stats
    /// </summary>
    [Function("GetDatabaseStats")]
    public async Task<IActionResult> GetStats(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "stats")] HttpRequest req)
    {
        try
        {
            var stats = await _gameService.GetStatsAsync();
            return new OkObjectResult(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting database stats");
            return new ObjectResult(new { error = "Failed to get stats", message = ex.Message })
            {
                StatusCode = (int)HttpStatusCode.InternalServerError
            };
        }
    }

    // Helper methods

    private static int[]? ParseIntArray(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        
        try
        {
            return value.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => int.TryParse(s.Trim(), out var i) ? i : (int?)null)
                .Where(i => i.HasValue)
                .Select(i => i!.Value)
                .ToArray();
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Admin endpoint to trigger a full re-sync of all games from TheGamesDB.
    /// This repopulates all game data including overview, rating, players, genres, publishers, and boxart.
    /// POST /api/admin/resync?syncLookups=true
    /// Requires Function key authorization.
    /// </summary>
    [Function("AdminResync")]
    public async Task<IActionResult> AdminResync(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "admin/resync")] HttpRequest req)
    {
        _logger.LogInformation("Admin resync triggered");

        if (_syncService == null)
        {
            return new ObjectResult(new { error = "Sync service not available" }) { StatusCode = 500 };
        }

        var syncLookups = bool.TryParse(req.Query["syncLookups"], out var sl) && sl;

        try
        {
            _logger.LogInformation("Starting full resync (syncLookups={SyncLookups})", syncLookups);
            await _syncService.SyncAllGamesAsync(
                interactiveMode: false,
                switchStartPage: 1,
                switch2StartPage: 1,
                syncLookupData: syncLookups
            );

            _logger.LogInformation("Full resync completed");

            return new OkObjectResult(new
            {
                message = "Full resync completed"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Full resync failed");
            return new ObjectResult(new { error = ex.Message }) { StatusCode = 500 };
        }
    }

    private class BulkIdsRequest
    {
        public int[] Ids { get; set; } = Array.Empty<int>();
    }
}
