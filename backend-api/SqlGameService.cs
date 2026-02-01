using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Dapper;
using System.Text.Json;

namespace SwitchLibraryApi;

/// <summary>
/// Service for querying game data from Azure SQL Database.
/// This replaces blob storage and TheGamesDB API for all user-facing queries.
/// Includes in-memory caching for improved performance.
/// </summary>
public class SqlGameService
{
    private readonly string _connectionString;
    private readonly ILogger<SqlGameService> _logger;
    private readonly IMemoryCache _cache;

    // Cache expiration times
    private static readonly TimeSpan LookupCacheExpiration = TimeSpan.FromHours(24);
    private static readonly TimeSpan StatsCacheExpiration = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan UpcomingGamesCacheExpiration = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan SearchCacheExpiration = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan GameDetailsCacheExpiration = TimeSpan.FromHours(1);
    private static readonly TimeSpan RecommendationsCacheExpiration = TimeSpan.FromMinutes(30);

    // Cache key prefixes
    private const string GenresCacheKey = "lookup_genres";
    private const string DevelopersCacheKey = "lookup_developers";
    private const string PublishersCacheKey = "lookup_publishers";
    private const string StatsCacheKey = "db_stats";

    // Image base URLs for constructing boxart URLs
    private const string BoxartBaseUrlOriginal = "https://cdn.thegamesdb.net/images/original/";
    private const string BoxartBaseUrlThumb = "https://cdn.thegamesdb.net/images/thumb/";
    private const string BoxartBaseUrlMedium = "https://cdn.thegamesdb.net/images/medium/";
    private const string BoxartBaseUrlLarge = "https://cdn.thegamesdb.net/images/large/";
    private const string BoxartBaseUrlSmall = "https://cdn.thegamesdb.net/images/small/";
    private const string BoxartBaseUrlCroppedThumb = "https://cdn.thegamesdb.net/images/cropped_center_thumb/";

    public SqlGameService(IConfiguration configuration, ILogger<SqlGameService> logger, IMemoryCache cache)
    {
        _connectionString = configuration["SqlDatabase__ConnectionString"] 
            ?? configuration.GetSection("SqlDatabase")["ConnectionString"] 
            ?? throw new InvalidOperationException("SQL Database connection string not configured");
        _logger = logger;
        _cache = cache;
    }

    /// <summary>
    /// Search games by name with optional filters and pagination (cached for 5 minutes)
    /// Note: Only basic queries with query+platform filters are cached to keep cache key simple
    /// </summary>
    public async Task<GameSearchResult> SearchGamesAsync(
        string query,
        int? platformId = null,
        int[]? genreIds = null,
        int[]? developerIds = null,
        int[]? publisherIds = null,
        int? releaseYear = null,
        bool? coop = null,
        int? minPlayers = null,
        int page = 1,
        int pageSize = 20)
    {
        // Only cache simple queries (no advanced filters) to keep cache manageable
        var useCache = genreIds == null && developerIds == null && publisherIds == null 
                      && releaseYear == null && coop == null && minPlayers == null;
        
        string? cacheKey = null;
        if (useCache)
        {
            cacheKey = GetSearchCacheKey(query, platformId, page, pageSize);
            if (_cache.TryGetValue(cacheKey, out GameSearchResult? cached) && cached != null)
            {
                _logger.LogDebug("Returning cached search results for: {Query}", query);
                return cached;
            }
        }

        _logger.LogInformation("Searching games: query={Query}, platform={Platform}, page={Page}", 
            query, platformId, page);

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var offset = (page - 1) * pageSize;

        // Build dynamic SQL with full-text search
        var whereClauses = new List<string>();
        var parameters = new DynamicParameters();

        // Full-text search on game_title (use CONTAINS for indexed search)
        if (!string.IsNullOrWhiteSpace(query))
        {
            // Use LIKE for partial matching if full-text not available, otherwise CONTAINS
            whereClauses.Add("(g.game_title LIKE @SearchPattern OR CONTAINS(g.game_title, @FtsQuery) OR g.alternates LIKE @SearchPattern)");
            parameters.Add("SearchPattern", $"%{query}%");
            parameters.Add("FtsQuery", $"\"{query}*\"");
        }

        // Platform filter
        if (platformId.HasValue)
        {
            whereClauses.Add("g.platform = @PlatformId");
            parameters.Add("PlatformId", platformId.Value);
        }

        // Genre filter (any match)
        if (genreIds?.Length > 0)
        {
            whereClauses.Add("EXISTS (SELECT 1 FROM games_genres gg WHERE gg.game_id = g.game_id AND gg.genre_id IN @GenreIds)");
            parameters.Add("GenreIds", genreIds);
        }

        // Developer filter
        if (developerIds?.Length > 0)
        {
            whereClauses.Add("EXISTS (SELECT 1 FROM games_developers gd WHERE gd.game_id = g.game_id AND gd.developer_id IN @DeveloperIds)");
            parameters.Add("DeveloperIds", developerIds);
        }

        // Publisher filter
        if (publisherIds?.Length > 0)
        {
            whereClauses.Add("EXISTS (SELECT 1 FROM games_publishers gp WHERE gp.game_id = g.game_id AND gp.publisher_id IN @PublisherIds)");
            parameters.Add("PublisherIds", publisherIds);
        }

        // Release year filter
        if (releaseYear.HasValue)
        {
            whereClauses.Add("YEAR(g.release_date) = @ReleaseYear");
            parameters.Add("ReleaseYear", releaseYear.Value);
        }

        // Co-op filter
        if (coop.HasValue)
        {
            whereClauses.Add("g.coop = @Coop");
            parameters.Add("Coop", coop.Value ? "Yes" : "No");
        }

        // Min players filter
        if (minPlayers.HasValue)
        {
            whereClauses.Add("g.players >= @MinPlayers");
            parameters.Add("MinPlayers", minPlayers.Value);
        }

        var whereClause = whereClauses.Count > 0 
            ? "WHERE " + string.Join(" AND ", whereClauses) 
            : "";

        // Get total count
        var countSql = $@"
            SELECT COUNT(DISTINCT g.game_id)
            FROM games_cache g
            {whereClause}";

        var totalCount = await connection.ExecuteScalarAsync<int>(countSql, parameters);

        // Get paged results with boxart
        var sql = $@"
            SELECT DISTINCT
                g.game_id AS Id,
                g.game_title AS GameTitle,
                g.release_date AS ReleaseDate,
                g.platform AS Platform,
                p.name AS PlatformName,
                g.region_id AS RegionId,
                g.players AS Players,
                g.overview AS Overview,
                g.rating AS Rating,
                g.coop AS Coop,
                g.youtube AS Youtube,
                g.alternates AS Alternates,
                g.last_updated AS LastUpdated,
                b.filename AS BoxartFilename
            FROM games_cache g
            LEFT JOIN platforms p ON g.platform = p.platform_id
            LEFT JOIN games_boxart b ON g.game_id = b.game_id AND b.type = 'boxart' AND b.side = 'front'
            {whereClause}
            ORDER BY 
                CASE WHEN g.game_title LIKE @ExactMatch THEN 0 ELSE 1 END,
                CASE WHEN g.region_id IN (1, 2) THEN 0 ELSE 1 END,
                g.game_title
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        parameters.Add("ExactMatch", query);
        parameters.Add("Offset", offset);
        parameters.Add("PageSize", pageSize);

        var games = (await connection.QueryAsync<GameSearchRow>(sql, parameters)).ToList();

        // Get genres, developers, publishers for found games
        if (games.Count > 0)
        {
            var gameIds = games.Select(g => g.Id).ToArray();
            await EnrichGamesWithRelatedData(connection, games, gameIds);
        }

        _logger.LogInformation("Search found {Count} games (total: {Total})", games.Count, totalCount);

        var result = new GameSearchResult
        {
            Games = games.Select(MapToGameDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };

        // Cache simple query results
        if (useCache && cacheKey != null)
        {
            _cache.Set(cacheKey, result, SearchCacheExpiration);
        }

        return result;
    }

    /// <summary>
    /// Get a single game by ID with full details (cached for 1 hour)
    /// </summary>
    public async Task<GameDto?> GetGameByIdAsync(int gameId)
    {
        var cacheKey = GetGameCacheKey(gameId);
        if (_cache.TryGetValue(cacheKey, out GameDto? cached) && cached != null)
        {
            _logger.LogDebug("Returning cached game details for: {GameId}", gameId);
            return cached;
        }

        _logger.LogInformation("Getting game by ID: {GameId}", gameId);

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var sql = @"
            SELECT 
                g.game_id AS Id,
                g.game_title AS GameTitle,
                g.release_date AS ReleaseDate,
                g.platform AS Platform,
                p.name AS PlatformName,
                g.region_id AS RegionId,
                g.country_id AS CountryId,
                g.players AS Players,
                g.overview AS Overview,
                g.rating AS Rating,
                g.coop AS Coop,
                g.youtube AS Youtube,
                g.os AS Os,
                g.processor AS Processor,
                g.ram AS Ram,
                g.hdd AS Hdd,
                g.video AS Video,
                g.sound AS Sound,
                g.alternates AS Alternates,
                g.last_updated AS LastUpdated,
                b.filename AS BoxartFilename
            FROM games_cache g
            LEFT JOIN platforms p ON g.platform = p.platform_id
            LEFT JOIN games_boxart b ON g.game_id = b.game_id AND b.type = 'boxart' AND b.side = 'front'
            WHERE g.game_id = @GameId";

        var game = await connection.QueryFirstOrDefaultAsync<GameSearchRow>(sql, new { GameId = gameId });

        if (game == null)
        {
            _logger.LogInformation("Game not found: {GameId}", gameId);
            return null;
        }

        // Get related data
        await EnrichGamesWithRelatedData(connection, new List<GameSearchRow> { game }, new[] { gameId });

        // Get all boxart for this game
        var boxartSql = @"
            SELECT id AS Id, type AS Type, side AS Side, filename AS Filename, resolution AS Resolution
            FROM games_boxart
            WHERE game_id = @GameId";

        var boxart = (await connection.QueryAsync<BoxartRow>(boxartSql, new { GameId = gameId })).ToList();

        var dto = MapToGameDto(game);
        dto.AllBoxart = boxart.Select(b => new BoxartDto
        {
            Type = b.Type,
            Side = b.Side,
            Filename = b.Filename,
            Resolution = b.Resolution,
            Urls = BuildBoxartUrls(b.Filename)
        }).ToList();

        // Cache the result
        _cache.Set(cacheKey, dto, GameDetailsCacheExpiration);

        return dto;
    }

    /// <summary>
    /// Get multiple games by IDs
    /// </summary>
    public async Task<List<GameDto>> GetGamesByIdsAsync(int[] gameIds)
    {
        if (gameIds.Length == 0) return new List<GameDto>();

        _logger.LogInformation("Getting games by IDs: count={Count}", gameIds.Length);

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var sql = @"
            SELECT 
                g.game_id AS Id,
                g.game_title AS GameTitle,
                g.release_date AS ReleaseDate,
                g.platform AS Platform,
                p.name AS PlatformName,
                g.region_id AS RegionId,
                g.players AS Players,
                g.overview AS Overview,
                g.rating AS Rating,
                g.coop AS Coop,
                g.alternates AS Alternates,
                b.filename AS BoxartFilename
            FROM games_cache g
            LEFT JOIN platforms p ON g.platform = p.platform_id
            LEFT JOIN games_boxart b ON g.game_id = b.game_id AND b.type = 'boxart' AND b.side = 'front'
            WHERE g.game_id IN @GameIds";

        var games = (await connection.QueryAsync<GameSearchRow>(sql, new { GameIds = gameIds })).ToList();

        if (games.Count > 0)
        {
            var foundIds = games.Select(g => g.Id).ToArray();
            await EnrichGamesWithRelatedData(connection, games, foundIds);
        }

        return games.Select(MapToGameDto).ToList();
    }

    /// <summary>
    /// Get upcoming game releases (cached for 15 minutes)
    /// </summary>
    public async Task<GameSearchResult> GetUpcomingGamesAsync(
        int days = 90,
        int? platformId = null,
        int page = 1,
        int pageSize = 20)
    {
        var cacheKey = GetUpcomingCacheKey(days, platformId, page, pageSize);
        if (_cache.TryGetValue(cacheKey, out GameSearchResult? cached) && cached != null)
        {
            _logger.LogDebug("Returning cached upcoming games");
            return cached;
        }

        _logger.LogInformation("Getting upcoming games: days={Days}, platform={Platform}", days, platformId);

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var parameters = new DynamicParameters();
        parameters.Add("StartDate", DateTime.UtcNow.Date);
        parameters.Add("EndDate", DateTime.UtcNow.Date.AddDays(days));
        parameters.Add("Offset", (page - 1) * pageSize);
        parameters.Add("PageSize", pageSize);

        var platformFilter = platformId.HasValue ? "AND g.platform = @PlatformId" : "";
        if (platformId.HasValue)
        {
            parameters.Add("PlatformId", platformId.Value);
        }

        // Get total count
        var countSql = $@"
            SELECT COUNT(*)
            FROM games_cache g
            WHERE g.release_date > @StartDate 
              AND g.release_date <= @EndDate
              {platformFilter}";

        var totalCount = await connection.ExecuteScalarAsync<int>(countSql, parameters);

        // Get paged results
        var sql = $@"
            SELECT 
                g.game_id AS Id,
                g.game_title AS GameTitle,
                g.release_date AS ReleaseDate,
                g.platform AS Platform,
                p.name AS PlatformName,
                g.region_id AS RegionId,
                g.players AS Players,
                g.overview AS Overview,
                g.rating AS Rating,
                g.coop AS Coop,
                g.alternates AS Alternates,
                b.filename AS BoxartFilename
            FROM games_cache g
            LEFT JOIN platforms p ON g.platform = p.platform_id
            LEFT JOIN games_boxart b ON g.game_id = b.game_id AND b.type = 'boxart' AND b.side = 'front'
            WHERE g.release_date > @StartDate 
              AND g.release_date <= @EndDate
              {platformFilter}
            ORDER BY g.release_date ASC, g.game_title
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        var games = (await connection.QueryAsync<GameSearchRow>(sql, parameters)).ToList();

        if (games.Count > 0)
        {
            var gameIds = games.Select(g => g.Id).ToArray();
            await EnrichGamesWithRelatedData(connection, games, gameIds);
        }

        var result = new GameSearchResult
        {
            Games = games.Select(MapToGameDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };

        _cache.Set(cacheKey, result, UpcomingGamesCacheExpiration);

        return result;
    }

    /// <summary>
    /// Get game recommendations based on genres, developers, publishers (cached for 30 minutes)
    /// </summary>
    public async Task<List<GameDto>> GetRecommendationsAsync(int gameId, int limit = 10)
    {
        var cacheKey = GetRecommendationsCacheKey(gameId, limit);
        if (_cache.TryGetValue(cacheKey, out List<GameDto>? cached) && cached != null)
        {
            _logger.LogDebug("Returning cached recommendations for game: {GameId}", gameId);
            return cached;
        }

        _logger.LogInformation("Getting recommendations for game: {GameId}", gameId);

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        // SQL query that scores games by similarity:
        // - Same genres: 3 points each
        // - Same developer: 2 points each
        // - Same publisher: 1 point each
        var sql = @"
            WITH SourceGame AS (
                SELECT game_id, platform FROM games_cache WHERE game_id = @GameId
            ),
            SourceGenres AS (
                SELECT genre_id FROM games_genres WHERE game_id = @GameId
            ),
            SourceDevelopers AS (
                SELECT developer_id FROM games_developers WHERE game_id = @GameId
            ),
            SourcePublishers AS (
                SELECT publisher_id FROM games_publishers WHERE game_id = @GameId
            ),
            ScoredGames AS (
                SELECT 
                    g.game_id,
                    COALESCE(gg.match_count, 0) * 3
                    + COALESCE(gd.match_count, 0) * 2
                    + COALESCE(gp.match_count, 0) AS score
                FROM games_cache g
                LEFT JOIN (
                    SELECT 
                        gg.game_id,
                        COUNT(*) AS match_count
                    FROM games_genres gg
                    INNER JOIN SourceGenres sg ON gg.genre_id = sg.genre_id
                    GROUP BY gg.game_id
                ) AS gg ON gg.game_id = g.game_id
                LEFT JOIN (
                    SELECT 
                        gd.game_id,
                        COUNT(*) AS match_count
                    FROM games_developers gd
                    INNER JOIN SourceDevelopers sd ON gd.developer_id = sd.developer_id
                    GROUP BY gd.game_id
                ) AS gd ON gd.game_id = g.game_id
                LEFT JOIN (
                    SELECT 
                        gp.game_id,
                        COUNT(*) AS match_count
                    FROM games_publishers gp
                    INNER JOIN SourcePublishers sp ON gp.publisher_id = sp.publisher_id
                    GROUP BY gp.game_id
                ) AS gp ON gp.game_id = g.game_id
                WHERE g.game_id != @GameId
                  AND g.platform IN (SELECT platform FROM SourceGame)
            )
            SELECT 
                g.game_id AS Id,
                g.game_title AS GameTitle,
                g.release_date AS ReleaseDate,
                g.platform AS Platform,
                p.name AS PlatformName,
                g.region_id AS RegionId,
                g.players AS Players,
                g.overview AS Overview,
                g.rating AS Rating,
                g.coop AS Coop,
                b.filename AS BoxartFilename,
                sg.score AS Score
            FROM ScoredGames sg
            JOIN games_cache g ON sg.game_id = g.game_id
            LEFT JOIN platforms p ON g.platform = p.platform_id
            LEFT JOIN games_boxart b ON g.game_id = b.game_id AND b.type = 'boxart' AND b.side = 'front'
            WHERE sg.score > 0
            ORDER BY sg.score DESC, g.game_title
            OFFSET 0 ROWS FETCH NEXT @Limit ROWS ONLY";

        var games = (await connection.QueryAsync<GameSearchRow>(sql, new { GameId = gameId, Limit = limit })).ToList();

        if (games.Count > 0)
        {
            var gameIds = games.Select(g => g.Id).ToArray();
            await EnrichGamesWithRelatedData(connection, games, gameIds);
        }

        var result = games.Select(MapToGameDto).ToList();
        _cache.Set(cacheKey, result, RecommendationsCacheExpiration);

        return result;
    }

    /// <summary>
    /// Get all genres (cached for 24 hours)
    /// </summary>
    public async Task<List<LookupDto>> GetGenresAsync()
    {
        if (_cache.TryGetValue(GenresCacheKey, out List<LookupDto>? cached) && cached != null)
        {
            _logger.LogDebug("Returning cached genres");
            return cached;
        }

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var sql = "SELECT genre_id AS Id, name AS Name FROM lookup_genres ORDER BY name";
        var results = (await connection.QueryAsync<LookupDto>(sql)).ToList();
        
        _cache.Set(GenresCacheKey, results, LookupCacheExpiration);
        _logger.LogInformation("Cached {Count} genres", results.Count);
        
        return results;
    }

    /// <summary>
    /// Get all developers (cached for 24 hours)
    /// </summary>
    public async Task<List<LookupDto>> GetDevelopersAsync()
    {
        if (_cache.TryGetValue(DevelopersCacheKey, out List<LookupDto>? cached) && cached != null)
        {
            _logger.LogDebug("Returning cached developers");
            return cached;
        }

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var sql = "SELECT developer_id AS Id, name AS Name FROM lookup_developers ORDER BY name";
        var results = (await connection.QueryAsync<LookupDto>(sql)).ToList();
        
        _cache.Set(DevelopersCacheKey, results, LookupCacheExpiration);
        _logger.LogInformation("Cached {Count} developers", results.Count);
        
        return results;
    }

    /// <summary>
    /// Get all publishers (cached for 24 hours)
    /// </summary>
    public async Task<List<LookupDto>> GetPublishersAsync()
    {
        if (_cache.TryGetValue(PublishersCacheKey, out List<LookupDto>? cached) && cached != null)
        {
            _logger.LogDebug("Returning cached publishers");
            return cached;
        }

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var sql = "SELECT publisher_id AS Id, name AS Name FROM lookup_publishers ORDER BY name";
        var results = (await connection.QueryAsync<LookupDto>(sql)).ToList();
        
        _cache.Set(PublishersCacheKey, results, LookupCacheExpiration);
        _logger.LogInformation("Cached {Count} publishers", results.Count);
        
        return results;
    }

    /// <summary>
    /// Get database statistics (cached for 5 minutes)
    /// </summary>
    public async Task<DatabaseStatsDto> GetStatsAsync()
    {
        if (_cache.TryGetValue(StatsCacheKey, out DatabaseStatsDto? cached) && cached != null)
        {
            _logger.LogDebug("Returning cached stats");
            return cached;
        }

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var sql = @"
            SELECT 
                (SELECT COUNT(*) FROM games_cache) AS TotalGames,
                (SELECT COUNT(*) FROM games_cache WHERE platform = 4971) AS SwitchGames,
                (SELECT COUNT(*) FROM games_cache WHERE platform = 5021) AS Switch2Games,
                (SELECT COUNT(*) FROM lookup_genres) AS TotalGenres,
                (SELECT COUNT(*) FROM lookup_developers) AS TotalDevelopers,
                (SELECT COUNT(*) FROM lookup_publishers) AS TotalPublishers,
                (SELECT last_sync_time FROM sync_metadata WHERE id = 1) AS LastSyncTime";

        var stats = await connection.QueryFirstAsync<DatabaseStatsDto>(sql);
        
        _cache.Set(StatsCacheKey, stats, StatsCacheExpiration);
        _logger.LogInformation("Cached database stats");
        
        return stats;
    }

    // Helper methods

    private async Task EnrichGamesWithRelatedData(SqlConnection connection, List<GameSearchRow> games, int[] gameIds)
    {
        // Get genres for all games
        var genresSql = @"
            SELECT gg.game_id AS GameId, lg.genre_id AS Id, lg.name AS Name
            FROM games_genres gg
            JOIN lookup_genres lg ON gg.genre_id = lg.genre_id
            WHERE gg.game_id IN @GameIds";
        var genres = await connection.QueryAsync<GameRelatedItem>(genresSql, new { GameIds = gameIds });
        var genresByGame = genres.GroupBy(g => g.GameId).ToDictionary(g => g.Key, g => g.ToList());

        // Get developers for all games
        var developersSql = @"
            SELECT gd.game_id AS GameId, ld.developer_id AS Id, ld.name AS Name
            FROM games_developers gd
            JOIN lookup_developers ld ON gd.developer_id = ld.developer_id
            WHERE gd.game_id IN @GameIds";
        var developers = await connection.QueryAsync<GameRelatedItem>(developersSql, new { GameIds = gameIds });
        var developersByGame = developers.GroupBy(d => d.GameId).ToDictionary(d => d.Key, d => d.ToList());

        // Get publishers for all games
        var publishersSql = @"
            SELECT gp.game_id AS GameId, lp.publisher_id AS Id, lp.name AS Name
            FROM games_publishers gp
            JOIN lookup_publishers lp ON gp.publisher_id = lp.publisher_id
            WHERE gp.game_id IN @GameIds";
        var publishers = await connection.QueryAsync<GameRelatedItem>(publishersSql, new { GameIds = gameIds });
        var publishersByGame = publishers.GroupBy(p => p.GameId).ToDictionary(p => p.Key, p => p.ToList());

        // Assign to games
        foreach (var game in games)
        {
            game.Genres = genresByGame.TryGetValue(game.Id, out var g) ? g : new List<GameRelatedItem>();
            game.Developers = developersByGame.TryGetValue(game.Id, out var d) ? d : new List<GameRelatedItem>();
            game.Publishers = publishersByGame.TryGetValue(game.Id, out var p) ? p : new List<GameRelatedItem>();
        }
    }

    private GameDto MapToGameDto(GameSearchRow row)
    {
        return new GameDto
        {
            Id = row.Id,
            GameTitle = row.GameTitle,
            ReleaseDate = row.ReleaseDate?.ToString("yyyy-MM-dd"),
            Platform = row.Platform,
            PlatformName = row.PlatformName ?? (row.Platform == 4971 ? "Nintendo Switch" : "Nintendo Switch 2"),
            RegionId = row.RegionId,
            Players = row.Players,
            Overview = row.Overview,
            Rating = row.Rating,
            Coop = row.Coop,
            Youtube = row.Youtube,
            Alternates = ParseAlternates(row.Alternates),
            Genres = row.Genres?.Select(g => new LookupDto { Id = g.Id, Name = g.Name }).ToList() ?? new List<LookupDto>(),
            Developers = row.Developers?.Select(d => new LookupDto { Id = d.Id, Name = d.Name }).ToList() ?? new List<LookupDto>(),
            Publishers = row.Publishers?.Select(p => new LookupDto { Id = p.Id, Name = p.Name }).ToList() ?? new List<LookupDto>(),
            Boxart = row.BoxartFilename != null ? BuildBoxartUrls(row.BoxartFilename) : null
        };
    }

    private BoxartUrlsDto? BuildBoxartUrls(string? filename)
    {
        if (string.IsNullOrEmpty(filename)) return null;

        return new BoxartUrlsDto
        {
            Filename = filename,
            Original = BoxartBaseUrlOriginal + filename,
            Small = BoxartBaseUrlSmall + filename,
            Thumb = BoxartBaseUrlThumb + filename,
            CroppedCenterThumb = BoxartBaseUrlCroppedThumb + filename,
            Medium = BoxartBaseUrlMedium + filename,
            Large = BoxartBaseUrlLarge + filename
        };
    }

    private List<string>? ParseAlternates(string? alternatesJson)
    {
        if (string.IsNullOrEmpty(alternatesJson)) return null;
        try
        {
            return JsonSerializer.Deserialize<List<string>>(alternatesJson);
        }
        catch
        {
            return null;
        }
    }

    // Cache key generation helpers
    private static string GetSearchCacheKey(string query, int? platformId, int page, int pageSize) =>
        $"search_{query?.ToLowerInvariant()}_{platformId}_{page}_{pageSize}";

    private static string GetGameCacheKey(int gameId) => $"game_{gameId}";

    private static string GetUpcomingCacheKey(int days, int? platformId, int page, int pageSize) =>
        $"upcoming_{days}_{platformId}_{page}_{pageSize}";

    private static string GetRecommendationsCacheKey(int gameId, int limit) =>
        $"recs_{gameId}_{limit}";

    // Internal row classes for Dapper mapping
    private class GameSearchRow
    {
        public int Id { get; set; }
        public string GameTitle { get; set; } = "";
        public DateTime? ReleaseDate { get; set; }
        public int Platform { get; set; }
        public string? PlatformName { get; set; }
        public int? RegionId { get; set; }
        public int? CountryId { get; set; }
        public int? Players { get; set; }
        public string? Overview { get; set; }
        public string? Rating { get; set; }
        public string? Coop { get; set; }
        public string? Youtube { get; set; }
        public string? Os { get; set; }
        public string? Processor { get; set; }
        public string? Ram { get; set; }
        public string? Hdd { get; set; }
        public string? Video { get; set; }
        public string? Sound { get; set; }
        public string? Alternates { get; set; }
        public DateTime? LastUpdated { get; set; }
        public string? BoxartFilename { get; set; }
        public int Score { get; set; }
        public List<GameRelatedItem>? Genres { get; set; }
        public List<GameRelatedItem>? Developers { get; set; }
        public List<GameRelatedItem>? Publishers { get; set; }
    }

    private class GameRelatedItem
    {
        public int GameId { get; set; }
        public int Id { get; set; }
        public string Name { get; set; } = "";
    }

    private class BoxartRow
    {
        public int Id { get; set; }
        public string? Type { get; set; }
        public string? Side { get; set; }
        public string? Filename { get; set; }
        public string? Resolution { get; set; }
    }
}

// DTOs for API responses
public class GameSearchResult
{
    public List<GameDto> Games { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

public class GameDto
{
    public int Id { get; set; }
    public string GameTitle { get; set; } = "";
    public string? ReleaseDate { get; set; }
    public int Platform { get; set; }
    public string PlatformName { get; set; } = "";
    public int? RegionId { get; set; }
    public int? Players { get; set; }
    public string? Overview { get; set; }
    public string? Rating { get; set; }
    public string? Coop { get; set; }
    public string? Youtube { get; set; }
    public List<string>? Alternates { get; set; }
    public List<LookupDto> Genres { get; set; } = new();
    public List<LookupDto> Developers { get; set; } = new();
    public List<LookupDto> Publishers { get; set; } = new();
    public BoxartUrlsDto? Boxart { get; set; }
    public List<BoxartDto>? AllBoxart { get; set; }
}

public class LookupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class BoxartUrlsDto
{
    public string Filename { get; set; } = "";
    public string Original { get; set; } = "";
    public string Small { get; set; } = "";
    public string Thumb { get; set; } = "";
    public string CroppedCenterThumb { get; set; } = "";
    public string Medium { get; set; } = "";
    public string Large { get; set; } = "";
}

public class BoxartDto
{
    public string? Type { get; set; }
    public string? Side { get; set; }
    public string? Filename { get; set; }
    public string? Resolution { get; set; }
    public BoxartUrlsDto? Urls { get; set; }
}

public class DatabaseStatsDto
{
    public int TotalGames { get; set; }
    public int SwitchGames { get; set; }
    public int Switch2Games { get; set; }
    public int TotalGenres { get; set; }
    public int TotalDevelopers { get; set; }
    public int TotalPublishers { get; set; }
    public DateTime? LastSyncTime { get; set; }
}
