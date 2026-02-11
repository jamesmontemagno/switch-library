using System.Data;
using System.Text.Json;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace GameSync.Core;

/// <summary>
/// SQL Database storage methods for GameSyncService
/// </summary>
public partial class GameSyncService
{
    private readonly SqlDatabaseSettings? _sqlSettings;

    private async Task<SqlConnection> GetSqlConnectionAsync()
    {
        if (_sqlSettings == null || string.IsNullOrWhiteSpace(_sqlSettings.ConnectionString))
        {
            throw new InvalidOperationException("SQL Database is not configured");
        }

        var connection = new SqlConnection(_sqlSettings.ConnectionString);
        connection.Open();
        return connection;
    }

    /// <summary>
    /// Save game data to SQL Database
    /// </summary>
    private async Task SaveGameToSqlAsync(int gameId, JsonElement gameData)
    {
        try
        {
            await using var connection = await GetSqlConnectionAsync();
            await using var transaction = connection.BeginTransaction();

            try
            {
                // Extract game properties
                var title = gameData.TryGetProperty("game_title", out var titleProp) ? titleProp.GetString() : null;
                
                var releaseDateStr = gameData.TryGetProperty("release_date", out var releaseDateProp) ? releaseDateProp.GetString() : null;
                var releaseDate = ParseNullableDate(releaseDateStr);
                if (releaseDateStr != null && releaseDate == null)
                {
                    _logger.LogWarning("Game {GameId}: Invalid release_date '{ReleaseDate}', setting to null", gameId, releaseDateStr);
                }
                
                var platform = gameData.TryGetProperty("platform", out var platformProp) && platformProp.ValueKind == JsonValueKind.Number ? platformProp.GetInt32() : 0;
                var regionId = gameData.TryGetProperty("region_id", out var regionIdProp) && regionIdProp.ValueKind == JsonValueKind.Number ? regionIdProp.GetInt32() : (int?)null;
                var countryId = gameData.TryGetProperty("country_id", out var countryIdProp) && countryIdProp.ValueKind == JsonValueKind.Number ? countryIdProp.GetInt32() : (int?)null;
                var players = gameData.TryGetProperty("players", out var playersProp) && playersProp.ValueKind == JsonValueKind.Number ? playersProp.GetInt32() : (int?)null;
                var overview = gameData.TryGetProperty("overview", out var overviewProp) && overviewProp.ValueKind != JsonValueKind.Null ? overviewProp.GetString() : null;
                
                var lastUpdatedStr = gameData.TryGetProperty("last_updated", out var lastUpdatedProp) && 
                                    lastUpdatedProp.ValueKind != JsonValueKind.Null ?
                    lastUpdatedProp.GetString() : null;
                var lastUpdated = ParseNullableDate(lastUpdatedStr);
                if (lastUpdatedStr != null && lastUpdated == null)
                {
                    _logger.LogWarning("Game {GameId}: Invalid last_updated '{LastUpdated}', setting to null", gameId, lastUpdatedStr);
                }
                
                var rating = gameData.TryGetProperty("rating", out var ratingProp) && ratingProp.ValueKind != JsonValueKind.Null ? ratingProp.GetString() : null;
                var coop = gameData.TryGetProperty("coop", out var coopProp) && coopProp.ValueKind != JsonValueKind.Null ? coopProp.GetString() : null;
                var youtubeRaw = gameData.TryGetProperty("youtube", out var youtubeProp) && youtubeProp.ValueKind != JsonValueKind.Null ? youtubeProp.GetString() : null;
                // Truncate youtube to 500 chars to prevent SQL truncation errors
                var youtube = youtubeRaw != null && youtubeRaw.Length > 500 ? youtubeRaw.Substring(0, 500) : youtubeRaw;
                var alternates = gameData.TryGetProperty("alternates", out var alternatesProp) && alternatesProp.ValueKind != JsonValueKind.Null ? alternatesProp.ToString() : null;

                // Merge game into games_cache table
                var gameSql = @"
                    MERGE games_cache AS target
                    USING (SELECT @gameId AS game_id) AS source
                    ON target.game_id = source.game_id
                    WHEN MATCHED THEN
                        UPDATE SET 
                            game_title = @title,
                            release_date = @releaseDate,
                            platform = @platform,
                            region_id = @regionId,
                            country_id = @countryId,
                            players = @players,
                            overview = @overview,
                            last_updated = @lastUpdated,
                            rating = @rating,
                            coop = @coop,
                            youtube = @youtube,
                            alternates = @alternates,
                            cached_at = GETUTCDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (game_id, game_title, release_date, platform, region_id, country_id, players, 
                                overview, last_updated, rating, coop, youtube, alternates, cached_at)
                        VALUES (@gameId, @title, @releaseDate, @platform, @regionId, @countryId, @players, 
                                @overview, @lastUpdated, @rating, @coop, @youtube, @alternates, GETUTCDATE());";

                await connection.ExecuteAsync(gameSql, new
                {
                    gameId,
                    title,
                    releaseDate,
                    platform,
                    regionId,
                    countryId,
                    players,
                    overview,
                    lastUpdated,
                    rating,
                    coop,
                    youtube,
                    alternates
                }, transaction);

                // Handle genres
                if (gameData.TryGetProperty("genres", out var genresProp) && genresProp.ValueKind == JsonValueKind.Array)
                {
                    // Extract unique genre IDs to prevent duplicate insert attempts
                    var genreIds = genresProp.EnumerateArray()
                        .Where(g => g.ValueKind == JsonValueKind.Number)
                        .Select(g => g.GetInt32())
                        .Distinct()
                        .ToList();

                    // Delete existing genres for this game
                    await connection.ExecuteAsync(
                        "DELETE FROM games_genres WHERE game_id = @gameId",
                        new { gameId },
                        transaction
                    );

                    // Insert new genres using MERGE to handle any race conditions
                    foreach (var genreId in genreIds)
                    {
                        await connection.ExecuteAsync(
                            @"MERGE games_genres AS target
                              USING (SELECT @gameId AS game_id, @genreId AS genre_id) AS source
                              ON target.game_id = source.game_id AND target.genre_id = source.genre_id
                              WHEN NOT MATCHED AND EXISTS (SELECT 1 FROM lookup_genres WHERE genre_id = @genreId) THEN
                                  INSERT (game_id, genre_id) VALUES (@gameId, @genreId);",
                            new { gameId, genreId },
                            transaction
                        );
                    }
                }

                // Handle developers
                if (gameData.TryGetProperty("developers", out var developersProp) && developersProp.ValueKind == JsonValueKind.Array)
                {
                    // Extract unique developer IDs to prevent duplicate insert attempts
                    var developerIds = developersProp.EnumerateArray()
                        .Where(d => d.ValueKind == JsonValueKind.Number)
                        .Select(d => d.GetInt32())
                        .Distinct()
                        .ToList();

                    // Delete existing developers for this game
                    await connection.ExecuteAsync(
                        "DELETE FROM games_developers WHERE game_id = @gameId",
                        new { gameId },
                        transaction
                    );

                    // Insert new developers using MERGE to handle any race conditions
                    foreach (var developerId in developerIds)
                    {
                        await connection.ExecuteAsync(
                            @"MERGE games_developers AS target
                              USING (SELECT @gameId AS game_id, @developerId AS developer_id) AS source
                              ON target.game_id = source.game_id AND target.developer_id = source.developer_id
                              WHEN NOT MATCHED AND EXISTS (SELECT 1 FROM lookup_developers WHERE developer_id = @developerId) THEN
                                  INSERT (game_id, developer_id) VALUES (@gameId, @developerId);",
                            new { gameId, developerId },
                            transaction
                        );
                    }
                }

                // Handle publishers
                if (gameData.TryGetProperty("publishers", out var publishersProp) && publishersProp.ValueKind == JsonValueKind.Array)
                {
                    // Extract unique publisher IDs to prevent duplicate insert attempts
                    var publisherIds = publishersProp.EnumerateArray()
                        .Where(p => p.ValueKind == JsonValueKind.Number)
                        .Select(p => p.GetInt32())
                        .Distinct()
                        .ToList();

                    // Delete existing publishers for this game
                    await connection.ExecuteAsync(
                        "DELETE FROM games_publishers WHERE game_id = @gameId",
                        new { gameId },
                        transaction
                    );

                    // Insert new publishers using MERGE to handle any race conditions
                    foreach (var publisherId in publisherIds)
                    {
                        await connection.ExecuteAsync(
                            @"MERGE games_publishers AS target
                              USING (SELECT @gameId AS game_id, @publisherId AS publisher_id) AS source
                              ON target.game_id = source.game_id AND target.publisher_id = source.publisher_id
                              WHEN NOT MATCHED AND EXISTS (SELECT 1 FROM lookup_publishers WHERE publisher_id = @publisherId) THEN
                                  INSERT (game_id, publisher_id) VALUES (@gameId, @publisherId);",
                            new { gameId, publisherId },
                            transaction
                        );
                    }
                }

                await transaction.CommitAsync();
                _logger.LogDebug("Saved game {GameId} to SQL database", gameId);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving game {GameId} to SQL database. Game data: {GameData}", 
                gameId, 
                gameData.ToString().Substring(0, Math.Min(500, gameData.ToString().Length)));
            throw;
        }
    }

    /// <summary>
    /// Get game data from SQL Database
    /// </summary>
    private async Task<object?> GetGameFromSqlAsync(int gameId)
    {
        try
        {
            await using var connection = await GetSqlConnectionAsync();

            var sql = "SELECT * FROM games_cache WHERE game_id = @gameId";
            var game = await connection.QueryFirstOrDefaultAsync(sql, new { gameId });

            return game;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error reading game {GameId} from SQL database", gameId);
            return null;
        }
    }

    /// <summary>
    /// Save lookup data (genres, developers, publishers) to SQL Database
    /// Uses bulk insert with batching for performance
    /// </summary>
    private async Task SaveLookupDataToSqlAsync(string lookupType, JsonElement data)
    {
        try
        {
            await using var connection = await GetSqlConnectionAsync();

            // Extract the data object (genres, developers, or publishers)
            if (!data.TryGetProperty("data", out var dataObj))
            {
                _logger.LogWarning("No data property found in lookup data for {LookupType}", lookupType);
                return;
            }

            if (!dataObj.TryGetProperty(lookupType, out var items))
            {
                _logger.LogWarning("No {LookupType} property found in data", lookupType);
                return;
            }

            var tableName = lookupType switch
            {
                "genres" => "lookup_genres",
                "developers" => "lookup_developers",
                "publishers" => "lookup_publishers",
                _ => throw new ArgumentException($"Unknown lookup type: {lookupType}")
            };

            var idColumn = lookupType switch
            {
                "genres" => "genre_id",
                "developers" => "developer_id",
                "publishers" => "publisher_id",
                _ => throw new ArgumentException($"Unknown lookup type: {lookupType}")
            };

            // Items is an object/dictionary with IDs as keys
            if (items.ValueKind == JsonValueKind.Object)
            {
                // Collect all items into a list for bulk processing
                var itemsToInsert = new List<(int Id, string Name)>();
                
                foreach (var item in items.EnumerateObject())
                {
                    if (int.TryParse(item.Name, out var itemId))
                    {
                        var itemData = item.Value;
                        var name = itemData.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;

                        if (!string.IsNullOrWhiteSpace(name))
                        {
                            itemsToInsert.Add((itemId, name));
                        }
                    }
                }

                var totalCount = itemsToInsert.Count;
                _logger.LogInformation("Processing {Total} {LookupType} records with bulk insert...", totalCount, lookupType);

                // Process in batches of 500 for optimal performance
                const int batchSize = 500;
                var batches = (int)Math.Ceiling(totalCount / (double)batchSize);
                
                for (int i = 0; i < batches; i++)
                {
                    var batch = itemsToInsert.Skip(i * batchSize).Take(batchSize).ToList();
                    
                    // Build VALUES clause for batch insert
                    var valuesClauses = new List<string>();
                    var parameters = new DynamicParameters();
                    
                    for (int j = 0; j < batch.Count; j++)
                    {
                        var paramId = $"@id{j}";
                        var paramName = $"@name{j}";
                        valuesClauses.Add($"({paramId}, {paramName}, GETUTCDATE())");
                        parameters.Add(paramId, batch[j].Id);
                        parameters.Add(paramName, batch[j].Name);
                    }

                    // Use MERGE with batched VALUES for efficient upsert
                    var sql = $@"
                        MERGE {tableName} AS target
                        USING (VALUES {string.Join(", ", valuesClauses)}) AS source ({idColumn}, name, cached_at)
                        ON target.{idColumn} = source.{idColumn}
                        WHEN MATCHED THEN
                            UPDATE SET name = source.name, cached_at = source.cached_at
                        WHEN NOT MATCHED THEN
                            INSERT ({idColumn}, name, cached_at)
                            VALUES (source.{idColumn}, source.name, source.cached_at);";

                    await connection.ExecuteAsync(sql, parameters, 
                        commandTimeout: _sqlSettings?.CommandTimeout ?? 300);
                    
                    var processed = (i + 1) * batchSize;
                    if (processed > totalCount) processed = totalCount;
                    
                    if (batches > 1)
                    {
                        _logger.LogInformation("Processed batch {Batch}/{TotalBatches}: {Count}/{Total} {LookupType} ({Percent:F1}%)", 
                            i + 1, batches, processed, totalCount, lookupType, (processed * 100.0 / totalCount));
                    }
                }

                _logger.LogInformation("Completed: Saved {Count} {LookupType} to SQL database using bulk insert", totalCount, lookupType);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving lookup data {LookupType} to SQL database", lookupType);
            throw;
        }
    }

    /// <summary>
    /// Get last sync time from SQL Database
    /// </summary>
    /// <summary>
    /// Get statistics from SQL Database
    /// </summary>
    private async Task<SyncStatistics> GetSqlStatisticsAsync()
    {
        try
        {
            await using var connection = await GetSqlConnectionAsync();

            var stats = new SyncStatistics
            {
                // Last sync time always comes from blob storage
                LastSyncTime = await GetLastSyncTimeAsync()
            };

            // Get game count
            stats.TotalGamesCached = await connection.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM games_cache"
            );

            // Check lookup data and get counts
            stats.GenreCount = await connection.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM lookup_genres"
            );
            stats.HasGenres = stats.GenreCount > 0;

            stats.DeveloperCount = await connection.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM lookup_developers"
            );
            stats.HasDevelopers = stats.DeveloperCount > 0;

            stats.PublisherCount = await connection.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM lookup_publishers"
            );
            stats.HasPublishers = stats.PublisherCount > 0;

            return stats;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting statistics from SQL database");
            return new SyncStatistics();
        }
    }

    /// <summary>
    /// Get last sync time from SQL Database
    /// </summary>
    private async Task<(DateTime? lastSyncTime, string? syncType, int gamesSynced)> GetLastSyncTimeFromSqlAsync()
    {
        try
        {
            await using var connection = await GetSqlConnectionAsync();
            
            var result = await connection.QueryFirstOrDefaultAsync<SyncMetadata>(
                "SELECT last_sync_time, sync_type, games_synced FROM sync_metadata WHERE id = 1"
            );

            if (result != null && result.LastSyncTime > new DateTime(1900, 1, 2))
            {
                return (result.LastSyncTime, result.SyncType, result.GamesSynced);
            }

            return (null, null, 0);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error reading last sync time from SQL database");
            return (null, null, 0);
        }
    }

    /// <summary>
    /// Save last sync time to SQL Database
    /// </summary>
    private async Task SaveLastSyncTimeToSqlAsync(string syncType, int gamesSynced = 0)
    {
        try
        {
            await using var connection = await GetSqlConnectionAsync();
            
            await connection.ExecuteAsync(
                @"UPDATE sync_metadata 
                  SET last_sync_time = @lastSyncTime, 
                      sync_type = @syncType, 
                      games_synced = games_synced + @gamesSynced
                  WHERE id = 1",
                new { lastSyncTime = DateTime.UtcNow, syncType, gamesSynced }
            );

            _logger.LogDebug("Saved last sync time to SQL database: {SyncType}, {GamesSynced} games", syncType, gamesSynced);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving last sync time to SQL database");
            throw;
        }
    }

    /// <summary>
    /// Helper method to safely parse nullable date strings with SQL Server range validation
    /// </summary>
    private DateTime? ParseNullableDate(string? dateString)
    {
        if (string.IsNullOrWhiteSpace(dateString))
        {
            return null;
        }

        // SQL Server DATETIME2 valid range: 0001-01-01 to 9999-12-31
        // But being conservative with 1753-01-01 (DATETIME minimum) to 9999-12-31
        DateTime minValidDate = new DateTime(1753, 1, 1);
        DateTime maxValidDate = new DateTime(9999, 12, 31);

        if (DateTime.TryParse(dateString, out var result))
        {
            // Validate the parsed date is within SQL Server's valid range
            if (result < minValidDate || result > maxValidDate)
            {
                _logger.LogWarning("Date '{DateString}' is outside SQL Server valid range (1753-01-01 to 9999-12-31), returning null", dateString);
                return null;
            }
            return result;
        }

        // If parsing failed, log and return null
        _logger.LogDebug("Failed to parse date string: {DateString}", dateString);
        return null;
    }

    /// <summary>
    /// Save boxart data for a game to SQL Database
    /// </summary>
    private async Task SaveBoxartToSqlAsync(int gameId, JsonElement boxartArray)
    {
        try
        {
            if (boxartArray.ValueKind != JsonValueKind.Array || boxartArray.GetArrayLength() == 0)
                return;

            await using var connection = await GetSqlConnectionAsync();
            await using var transaction = connection.BeginTransaction();

            try
            {
                // Delete existing boxart for this game
                await connection.ExecuteAsync(
                    "DELETE FROM games_boxart WHERE game_id = @gameId",
                    new { gameId },
                    transaction
                );

                // Insert new boxart entries
                foreach (var img in boxartArray.EnumerateArray())
                {
                    var id = img.TryGetProperty("id", out var idProp) ? idProp.GetInt32() : 0;
                    if (id == 0) continue;

                    var type = img.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : null;
                    var side = img.TryGetProperty("side", out var sideProp) ? sideProp.GetString() : null;
                    var filename = img.TryGetProperty("filename", out var filenameProp) ? filenameProp.GetString() : null;
                    var resolution = img.TryGetProperty("resolution", out var resProp) ? resProp.GetString() : null;

                    if (string.IsNullOrEmpty(filename)) continue;

                    await connection.ExecuteAsync(
                        @"MERGE games_boxart AS target
                          USING (SELECT @id AS id) AS source
                          ON target.id = source.id
                          WHEN MATCHED THEN
                              UPDATE SET game_id = @gameId, type = @type, side = @side, filename = @filename, resolution = @resolution
                          WHEN NOT MATCHED THEN
                              INSERT (id, game_id, type, side, filename, resolution)
                              VALUES (@id, @gameId, @type, @side, @filename, @resolution);",
                        new { id, gameId, type, side, filename, resolution },
                        transaction
                    );
                }

                await transaction.CommitAsync();
                _logger.LogDebug("Saved {Count} boxart entries for game {GameId}", boxartArray.GetArrayLength(), gameId);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error saving boxart for game {GameId}", gameId);
            // Don't throw - boxart is not critical, we don't want to fail the sync
        }
    }

    /// <summary>
    /// Delete a game from SQL Database (CASCADE handles junction tables)
    /// </summary>
    private async Task DeleteGameFromSqlAsync(int gameId)
    {
        try
        {
            await using var connection = await GetSqlConnectionAsync();
            await connection.ExecuteAsync(
                "DELETE FROM games_cache WHERE game_id = @gameId",
                new { gameId }
            );
            _logger.LogDebug("Deleted game {GameId} from SQL database", gameId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error deleting game {GameId} from SQL database", gameId);
        }
    }

    /// <summary>
    /// Save a new game to SQL Database directly from update fields (no API call needed)
    /// </summary>
    private async Task SaveNewGameFromUpdatesAsync(int gameId, GameUpdateInfo info)
    {
        try
        {
            await using var connection = await GetSqlConnectionAsync();
            await using var transaction = connection.BeginTransaction();

            try
            {
                var title = GetStringField(info, "game_title");
                var releaseDateStr = GetStringField(info, "release_date");
                var releaseDate = ParseNullableDate(releaseDateStr);
                var platform = info.Platform ?? 0;
                var regionId = GetIntField(info, "region_id");
                var countryId = GetIntField(info, "country_id");
                var players = GetIntField(info, "players");
                var overview = GetStringField(info, "overview");
                var rating = GetStringField(info, "rating");
                var coop = GetStringField(info, "coop");
                var youtube = GetStringField(info, "youtube");
                string? alternates = null;
                if (info.Fields.TryGetValue("alternates", out var altVal))
                {
                    alternates = altVal.ToString();
                }

                var gameSql = @"
                    MERGE games_cache AS target
                    USING (SELECT @gameId AS game_id) AS source
                    ON target.game_id = source.game_id
                    WHEN MATCHED THEN
                        UPDATE SET 
                            game_title = @title,
                            release_date = @releaseDate,
                            platform = @platform,
                            region_id = @regionId,
                            country_id = @countryId,
                            players = @players,
                            overview = @overview,
                            rating = @rating,
                            coop = @coop,
                            youtube = @youtube,
                            alternates = @alternates,
                            cached_at = GETUTCDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (game_id, game_title, release_date, platform, region_id, country_id, players, 
                                overview, rating, coop, youtube, alternates, cached_at)
                        VALUES (@gameId, @title, @releaseDate, @platform, @regionId, @countryId, @players, 
                                @overview, @rating, @coop, @youtube, @alternates, GETUTCDATE());";

                await connection.ExecuteAsync(gameSql, new
                {
                    gameId, title, releaseDate, platform, regionId, countryId,
                    players, overview, rating, coop, youtube, alternates
                }, transaction);

                // Handle junction tables
                await SaveJunctionFromUpdatesAsync(connection, transaction, gameId, info, "genres", "games_genres", "genre_id", "lookup_genres");
                await SaveJunctionFromUpdatesAsync(connection, transaction, gameId, info, "developers", "games_developers", "developer_id", "lookup_developers");
                await SaveJunctionFromUpdatesAsync(connection, transaction, gameId, info, "publishers", "games_publishers", "publisher_id", "lookup_publishers");

                await transaction.CommitAsync();
                _logger.LogDebug("Saved new game {GameId} from update fields", gameId);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving new game {GameId} from updates", gameId);
            throw;
        }
    }

    /// <summary>
    /// Apply individual field updates to an existing game in SQL Database
    /// </summary>
    private async Task ApplyFieldUpdatesAsync(int gameId, Dictionary<string, JsonElement> fields)
    {
        try
        {
            await using var connection = await GetSqlConnectionAsync();
            await using var transaction = connection.BeginTransaction();

            try
            {
                // Build dynamic UPDATE for simple columns
                var setClauses = new List<string>();
                var parameters = new DynamicParameters();
                parameters.Add("gameId", gameId);

                foreach (var (fieldType, value) in fields)
                {
                    switch (fieldType)
                    {
                        case "game_title":
                            setClauses.Add("game_title = @game_title");
                            parameters.Add("game_title", GetStringFromElement(value));
                            break;
                        case "overview":
                            setClauses.Add("overview = @overview");
                            parameters.Add("overview", GetStringFromElement(value));
                            break;
                        case "release_date":
                            setClauses.Add("release_date = @release_date");
                            parameters.Add("release_date", ParseNullableDate(GetStringFromElement(value)));
                            break;
                        case "players":
                            setClauses.Add("players = @players");
                            parameters.Add("players", GetIntFromElement(value));
                            break;
                        case "coop":
                            setClauses.Add("coop = @coop");
                            parameters.Add("coop", GetStringFromElement(value));
                            break;
                        case "youtube":
                            setClauses.Add("youtube = @youtube");
                            parameters.Add("youtube", GetStringFromElement(value));
                            break;
                        case "rating":
                            setClauses.Add("rating = @rating");
                            parameters.Add("rating", GetStringFromElement(value));
                            break;
                        case "region_id":
                            setClauses.Add("region_id = @region_id");
                            parameters.Add("region_id", GetIntFromElement(value));
                            break;
                        case "country_id":
                            setClauses.Add("country_id = @country_id");
                            parameters.Add("country_id", GetIntFromElement(value));
                            break;
                        case "platform":
                            setClauses.Add("platform = @platform");
                            parameters.Add("platform", GetIntFromElement(value));
                            break;
                        case "alternates":
                            setClauses.Add("alternates = @alternates");
                            parameters.Add("alternates", value.ToString());
                            break;
                    }
                }

                // Execute column updates if any
                if (setClauses.Any())
                {
                    setClauses.Add("cached_at = GETUTCDATE()");
                    var sql = $"UPDATE games_cache SET {string.Join(", ", setClauses)} WHERE game_id = @gameId";
                    await connection.ExecuteAsync(sql, parameters, transaction);
                }

                // Handle junction table updates
                var updateInfo = new GameUpdateInfo { Fields = fields };
                if (fields.ContainsKey("genres"))
                    await SaveJunctionFromUpdatesAsync(connection, transaction, gameId, updateInfo, "genres", "games_genres", "genre_id", "lookup_genres");
                if (fields.ContainsKey("developers"))
                    await SaveJunctionFromUpdatesAsync(connection, transaction, gameId, updateInfo, "developers", "games_developers", "developer_id", "lookup_developers");
                if (fields.ContainsKey("publishers"))
                    await SaveJunctionFromUpdatesAsync(connection, transaction, gameId, updateInfo, "publishers", "games_publishers", "publisher_id", "lookup_publishers");

                await transaction.CommitAsync();
                _logger.LogDebug("Applied {Count} field updates to game {GameId}", fields.Count, gameId);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error applying field updates to game {GameId}", gameId);
            throw;
        }
    }

    /// <summary>
    /// Helper: save junction table data (genres/developers/publishers) from update fields
    /// </summary>
    private async Task SaveJunctionFromUpdatesAsync(
        SqlConnection connection, System.Data.Common.DbTransaction transaction,
        int gameId, GameUpdateInfo info,
        string fieldName, string tableName, string idColumn, string lookupTable)
    {
        if (!info.Fields.TryGetValue(fieldName, out var value) || value.ValueKind != JsonValueKind.Array)
            return;

        var ids = value.EnumerateArray()
            .Where(v => v.ValueKind == JsonValueKind.Number)
            .Select(v => v.GetInt32())
            .Distinct()
            .ToList();

        // Delete existing
        await connection.ExecuteAsync(
            $"DELETE FROM {tableName} WHERE game_id = @gameId",
            new { gameId }, transaction);

        // Insert new
        foreach (var id in ids)
        {
            await connection.ExecuteAsync(
                $@"MERGE {tableName} AS target
                   USING (SELECT @gameId AS game_id, @itemId AS {idColumn}) AS source
                   ON target.game_id = source.game_id AND target.{idColumn} = source.{idColumn}
                   WHEN NOT MATCHED AND EXISTS (SELECT 1 FROM {lookupTable} WHERE {idColumn} = @itemId) THEN
                       INSERT (game_id, {idColumn}) VALUES (@gameId, @itemId);",
                new { gameId, itemId = id }, transaction);
        }
    }

    // =============================================
    // Field extraction helpers for update values
    // =============================================

    private static string? GetStringField(GameUpdateInfo info, string fieldName)
    {
        if (info.Fields.TryGetValue(fieldName, out var val))
            return GetStringFromElement(val);
        return null;
    }

    private static int? GetIntField(GameUpdateInfo info, string fieldName)
    {
        if (info.Fields.TryGetValue(fieldName, out var val))
            return GetIntFromElement(val);
        return null;
    }

    private static string? GetStringFromElement(JsonElement el)
    {
        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Null => null,
            _ => el.ToString()
        };
    }

    private static int? GetIntFromElement(JsonElement el)
    {
        return el.ValueKind switch
        {
            JsonValueKind.Number => el.GetInt32(),
            JsonValueKind.String when int.TryParse(el.GetString(), out var i) => i,
            _ => null
        };
    }

    /// <summary>
    /// Get game IDs from SQL Database that have no boxart entries
    /// </summary>
    public async Task<List<int>> GetGameIdsWithMissingBoxartAsync()
    {
        if (_storageMode != StorageMode.SqlDatabase && _storageMode != StorageMode.Dual)
        {
            throw new InvalidOperationException("Missing boxart sync requires SQL Database storage mode");
        }

        await using var connection = await GetSqlConnectionAsync();

        var sql = @"
            SELECT g.game_id
            FROM games_cache g
            LEFT JOIN games_boxart b ON g.game_id = b.game_id
            WHERE b.id IS NULL
            ORDER BY g.game_id";

        var gameIds = (await connection.QueryAsync<int>(sql)).ToList();
        return gameIds;
    }

    /// <summary>
    /// Sync missing boxart for games that have no boxart entries in the database.
    /// Queries TheGamesDB API in batches and saves boxart to SQL.
    /// </summary>
    /// <param name="interactiveMode">Enable interactive prompts between batches</param>
    /// <param name="batchSize">Number of game IDs to fetch per API call (max 20)</param>
    /// <returns>Number of games that had boxart added</returns>
    public async Task<int> SyncMissingBoxartAsync(bool interactiveMode = false, int batchSize = 20)
    {
        _logger.LogInformation("Starting missing boxart sync...");

        // Get all game IDs without boxart
        var missingIds = await GetGameIdsWithMissingBoxartAsync();

        if (missingIds.Count == 0)
        {
            _logger.LogInformation("All games already have boxart - nothing to do!");
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("All games already have boxart - nothing to do!");
            Console.ResetColor();
            return 0;
        }

        _logger.LogInformation("Found {Count} games with missing boxart", missingIds.Count);
        Console.WriteLine($"Found {missingIds.Count} games with missing boxart.");
        Console.WriteLine();

        var totalUpdated = 0;
        var totalSkipped = 0;
        var autoComplete = false;

        // Process in batches (TheGamesDB API supports comma-separated IDs)
        var batches = missingIds
            .Select((id, index) => new { id, index })
            .GroupBy(x => x.index / batchSize)
            .Select(g => g.Select(x => x.id).ToList())
            .ToList();

        for (var i = 0; i < batches.Count; i++)
        {
            var batch = batches[i];
            var idsParam = string.Join(",", batch);

            _logger.LogInformation("Fetching boxart for batch {Batch}/{Total} ({Count} games)...",
                i + 1, batches.Count, batch.Count);

            try
            {
                var url = $"{ApiBaseUrl}/Games/ByGameID?apikey={_apiKey}&id={idsParam}&include=boxart";

                _logger.LogDebug("Request URL: {Url}", url.Replace(_apiKey, "***"));

                JsonDocument? jsonDoc = null;
                var retryCount = 0;
                var success = false;

                while (retryCount <= MaxRetries && !success)
                {
                    try
                    {
                        var response = await _httpClient.GetAsync(url);

                        if (!response.IsSuccessStatusCode)
                        {
                            _logger.LogError("API request failed: {StatusCode}", response.StatusCode);

                            if (response.StatusCode == System.Net.HttpStatusCode.GatewayTimeout ||
                                response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable ||
                                response.StatusCode == System.Net.HttpStatusCode.RequestTimeout)
                            {
                                retryCount++;
                                if (retryCount <= MaxRetries)
                                {
                                    var delay = InitialRetryDelayMs * (int)Math.Pow(2, retryCount - 1);
                                    _logger.LogWarning("Retrying in {Delay}ms (attempt {Attempt}/{MaxRetries})...",
                                        delay, retryCount, MaxRetries);
                                    await Task.Delay(delay);
                                    continue;
                                }
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
                            _logger.LogWarning(ex, "Network error on batch {Batch}. Retrying in {Delay}ms (attempt {Attempt}/{MaxRetries})...",
                                i + 1, delay, retryCount, MaxRetries);
                            await Task.Delay(delay);
                        }
                        else
                        {
                            _logger.LogError(ex, "Network error on batch {Batch} after {MaxRetries} retries", i + 1, MaxRetries);
                            throw;
                        }
                    }
                    catch (TaskCanceledException ex)
                    {
                        retryCount++;
                        if (retryCount <= MaxRetries)
                        {
                            var delay = InitialRetryDelayMs * (int)Math.Pow(2, retryCount - 1);
                            _logger.LogWarning(ex, "Request timeout on batch {Batch}. Retrying in {Delay}ms (attempt {Attempt}/{MaxRetries})...",
                                i + 1, delay, retryCount, MaxRetries);
                            await Task.Delay(delay);
                        }
                        else
                        {
                            _logger.LogError(ex, "Request timeout on batch {Batch} after {MaxRetries} retries", i + 1, MaxRetries);
                            throw;
                        }
                    }
                }

                if (!success || jsonDoc == null)
                {
                    _logger.LogError("Failed to fetch batch {Batch} after retries, skipping {Count} games",
                        i + 1, batch.Count);
                    totalSkipped += batch.Count;
                    continue;
                }

                // Extract boxart from the include section
                // Note: TheGamesDB returns "data" as an object keyed by game ID when boxart exists,
                // but as an empty array [] when no games in the batch have boxart.
                var hasInclude = jsonDoc.RootElement.TryGetProperty("include", out var include);
                var boxartInclude = default(JsonElement);
                var hasBoxart = hasInclude && include.TryGetProperty("boxart", out boxartInclude);
                var boxartData = default(JsonElement);
                var hasBoxartData = hasBoxart && boxartInclude.TryGetProperty("data", out boxartData);

                if (hasBoxartData && boxartData.ValueKind == JsonValueKind.Object)
                {
                    foreach (var entry in boxartData.EnumerateObject())
                    {
                        if (int.TryParse(entry.Name, out var gameId))
                        {
                            await SaveBoxartToSqlAsync(gameId, entry.Value);
                            totalUpdated++;
                            _logger.LogDebug("Saved boxart for game {GameId}", gameId);
                        }
                    }

                    // Count games in this batch that didn't have boxart in the API response
                    var gamesWithBoxart = boxartData.EnumerateObject()
                        .Select(e => int.TryParse(e.Name, out var id) ? id : 0)
                        .Where(id => id > 0)
                        .ToHashSet();
                    var noBoxartInApi = batch.Count(id => !gamesWithBoxart.Contains(id));
                    if (noBoxartInApi > 0)
                    {
                        totalSkipped += noBoxartInApi;
                        _logger.LogDebug("{Count} games in batch {Batch} had no boxart available from TheGamesDB",
                            noBoxartInApi, i + 1);
                    }
                }
                else
                {
                    totalSkipped += batch.Count;
                    _logger.LogDebug("No boxart available on TheGamesDB for any game in batch {Batch}", i + 1);
                }

                Console.WriteLine($"  Batch {i + 1}/{batches.Count}: {totalUpdated} updated, {totalSkipped} not available on TheGamesDB");

                // Interactive mode prompt
                if (interactiveMode && !autoComplete && i < batches.Count - 1)
                {
                    Console.WriteLine();
                    Console.WriteLine("-------------------------------------------");
                    Console.WriteLine($"Batch {i + 1}/{batches.Count} completed.");
                    Console.WriteLine("  [C] Continue to next batch");
                    Console.WriteLine("  [A] Auto-complete remaining batches");
                    Console.WriteLine("  [Q] Quit");
                    Console.WriteLine("-------------------------------------------");
                    Console.Write("Your choice (C/A/Q): ");

                    var choice = Console.ReadLine()?.Trim().ToUpperInvariant();
                    Console.WriteLine();

                    switch (choice)
                    {
                        case "Q":
                            _logger.LogWarning("Missing boxart sync cancelled by user at batch {Batch}", i + 1);
                            Console.WriteLine($"Sync cancelled. {totalUpdated} games had boxart added.");
                            return totalUpdated;
                        case "A":
                            autoComplete = true;
                            Console.WriteLine("Auto-completing remaining batches...");
                            break;
                        case "C":
                        case "":
                            break;
                        default:
                            Console.WriteLine("Invalid choice. Continuing...");
                            break;
                    }
                }

                // Rate limiting delay between batches
                if (i < batches.Count - 1)
                {
                    await Task.Delay(2000);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error processing batch {Batch}, skipping", i + 1);
                totalSkipped += batch.Count;
            }
        }

        _logger.LogInformation("Missing boxart sync completed: {Updated} games updated, {Skipped} not available on TheGamesDB",
            totalUpdated, totalSkipped);

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"Summary: {totalUpdated} games had boxart added, {totalSkipped} games have no boxart available on TheGamesDB.");
        Console.ResetColor();

        return totalUpdated;
    }

    private class SyncMetadata
    {
        public DateTime LastSyncTime { get; set; }
        public string? SyncType { get; set; }
        public int GamesSynced { get; set; }
    }
}
