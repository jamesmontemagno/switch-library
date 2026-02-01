using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Dapper;

namespace GameSyncTool;

/// <summary>
/// Handles database schema initialization and migrations
/// </summary>
public class DatabaseInitializer
{
    private readonly SqlDatabaseSettings _settings;
    private readonly ILogger<DatabaseInitializer> _logger;

    public DatabaseInitializer(SqlDatabaseSettings settings, ILogger<DatabaseInitializer> logger)
    {
        _settings = settings;
        _logger = logger;
    }

    /// <summary>
    /// Ensure database schema is initialized and up to date
    /// </summary>
    public async Task EnsureDatabaseAsync()
    {
        if (string.IsNullOrWhiteSpace(_settings.ConnectionString))
        {
            _logger.LogWarning("SQL Database connection string not configured, skipping initialization");
            return;
        }

        try
        {
            _logger.LogInformation("Checking database schema...");

            await using var connection = new SqlConnection(_settings.ConnectionString);
            await connection.OpenAsync();

            // Check if migration tracking table exists
            var hasSchema = await CheckSchemaExistsAsync(connection);

            if (!hasSchema)
            {
                _logger.LogInformation("Database schema not found. Creating initial schema...");
                await CreateInitialSchemaAsync(connection);
                _logger.LogInformation("Database schema created successfully");
            }
            else
            {
                _logger.LogInformation("Database schema is initialized");
                // Future: Check version and run migrations if needed
                // await RunMigrationsAsync(connection);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing database schema");
            throw;
        }
    }

    private async Task<bool> CheckSchemaExistsAsync(SqlConnection connection)
    {
        try
        {
            var query = @"
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'schema_migrations'";

            var count = await connection.ExecuteScalarAsync<int>(query);
            return count > 0;
        }
        catch
        {
            return false;
        }
    }

    private async Task CreateInitialSchemaAsync(SqlConnection connection)
    {
        // Create schema migrations table first
        await connection.ExecuteAsync(@"
            CREATE TABLE schema_migrations (
                version INT PRIMARY KEY,
                applied_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                description NVARCHAR(500)
            );
        ");

        // Create games_cache table
        await connection.ExecuteAsync(@"
            CREATE TABLE games_cache (
                game_id INT PRIMARY KEY,
                game_title NVARCHAR(500) NOT NULL,
                release_date DATE,
                platform INT NOT NULL,
                region_id INT,
                country_id INT,
                players INT,
                overview NVARCHAR(MAX),
                last_updated DATETIME2,
                rating NVARCHAR(50),
                coop NVARCHAR(10),
                youtube NVARCHAR(100),
                os NVARCHAR(500),
                processor NVARCHAR(500),
                ram NVARCHAR(500),
                hdd NVARCHAR(500),
                video NVARCHAR(500),
                sound NVARCHAR(500),
                alternates NVARCHAR(MAX),
                cached_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
            );
        ");

        // Create indexes on games_cache
        await connection.ExecuteAsync(@"
            CREATE INDEX IX_games_cache_platform ON games_cache(platform);
            CREATE INDEX IX_games_cache_release_date ON games_cache(release_date);
            CREATE INDEX IX_games_cache_last_updated ON games_cache(last_updated);
        ");

        // Create boxart table
        await connection.ExecuteAsync(@"
            CREATE TABLE games_boxart (
                id INT PRIMARY KEY,
                game_id INT NOT NULL,
                type NVARCHAR(50),
                side NVARCHAR(20),
                filename NVARCHAR(500),
                resolution NVARCHAR(50),
                CONSTRAINT FK_boxart_game FOREIGN KEY (game_id) 
                    REFERENCES games_cache(game_id) ON DELETE CASCADE
            );
            CREATE INDEX IX_boxart_game_id ON games_boxart(game_id);
        ");

        // Create lookup tables
        await connection.ExecuteAsync(@"
            CREATE TABLE lookup_genres (
                genre_id INT PRIMARY KEY,
                name NVARCHAR(200) NOT NULL,
                cached_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
            );

            CREATE TABLE lookup_developers (
                developer_id INT PRIMARY KEY,
                name NVARCHAR(500) NOT NULL,
                cached_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
            );

            CREATE TABLE lookup_publishers (
                publisher_id INT PRIMARY KEY,
                name NVARCHAR(500) NOT NULL,
                cached_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
            );
        ");

        // Create junction tables
        await connection.ExecuteAsync(@"
            CREATE TABLE games_genres (
                game_id INT NOT NULL,
                genre_id INT NOT NULL,
                PRIMARY KEY (game_id, genre_id),
                CONSTRAINT FK_games_genres_game FOREIGN KEY (game_id) 
                    REFERENCES games_cache(game_id) ON DELETE CASCADE,
                CONSTRAINT FK_games_genres_genre FOREIGN KEY (genre_id) 
                    REFERENCES lookup_genres(genre_id) ON DELETE CASCADE
            );
            CREATE INDEX IX_games_genres_genre_id ON games_genres(genre_id);

            CREATE TABLE games_developers (
                game_id INT NOT NULL,
                developer_id INT NOT NULL,
                PRIMARY KEY (game_id, developer_id),
                CONSTRAINT FK_games_developers_game FOREIGN KEY (game_id) 
                    REFERENCES games_cache(game_id) ON DELETE CASCADE,
                CONSTRAINT FK_games_developers_developer FOREIGN KEY (developer_id) 
                    REFERENCES lookup_developers(developer_id) ON DELETE CASCADE
            );
            CREATE INDEX IX_games_developers_developer_id ON games_developers(developer_id);

            CREATE TABLE games_publishers (
                game_id INT NOT NULL,
                publisher_id INT NOT NULL,
                PRIMARY KEY (game_id, publisher_id),
                CONSTRAINT FK_games_publishers_game FOREIGN KEY (game_id) 
                    REFERENCES games_cache(game_id) ON DELETE CASCADE,
                CONSTRAINT FK_games_publishers_publisher FOREIGN KEY (publisher_id) 
                    REFERENCES lookup_publishers(publisher_id) ON DELETE CASCADE
            );
            CREATE INDEX IX_games_publishers_publisher_id ON games_publishers(publisher_id);
        ");

        // Create sync_metadata table
        await connection.ExecuteAsync(@"
            CREATE TABLE sync_metadata (
                id INT PRIMARY KEY DEFAULT 1,
                last_sync_time DATETIME2 NOT NULL,
                sync_type NVARCHAR(50),
                games_synced INT DEFAULT 0,
                CONSTRAINT CHK_sync_metadata_single_row CHECK (id = 1)
            );
            INSERT INTO sync_metadata (id, last_sync_time, sync_type) 
            VALUES (1, '1900-01-01', 'none');
        ");

        // Create platforms table
        await connection.ExecuteAsync(@"
            CREATE TABLE platforms (
                platform_id INT PRIMARY KEY,
                name NVARCHAR(200) NOT NULL,
                alias NVARCHAR(200)
            );
            INSERT INTO platforms (platform_id, name, alias) VALUES
            (4971, 'Nintendo Switch', 'switch'),
            (5021, 'Nintendo Switch 2', 'switch2');
        ");

        // Record this migration
        await connection.ExecuteAsync(@"
            INSERT INTO schema_migrations (version, description) 
            VALUES (1, 'Initial schema creation');
        ");

        _logger.LogInformation("Created initial database schema (version 1)");
    }

    /// <summary>
    /// Run any pending migrations (for future use)
    /// </summary>
    private async Task RunMigrationsAsync(SqlConnection connection)
    {
        // Get current version
        var currentVersion = await connection.ExecuteScalarAsync<int?>(
            "SELECT MAX(version) FROM schema_migrations") ?? 0;

        _logger.LogInformation("Current database schema version: {Version}", currentVersion);

        // Future migrations would go here
        // if (currentVersion < 2)
        // {
        //     await ApplyMigration2Async(connection);
        // }
    }
}
