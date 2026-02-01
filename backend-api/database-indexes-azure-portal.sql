-- =============================================
-- Performance Indexes for Switch Library API
-- Azure Portal Compatible Version
-- =============================================
-- This script creates indexes to optimize common query patterns
-- Run this in Azure Portal Query Editor
-- =============================================

-- Create temp table to track status
DECLARE @Results TABLE (
    Step INT IDENTITY(1,1),
    IndexName NVARCHAR(200),
    Status NVARCHAR(50)
);

-- =============================================
-- Search Performance Indexes
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_cache_title_platform_release')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_cache_title_platform_release
    ON games_cache(game_title, platform, release_date)
    INCLUDE (region_id, players, overview, rating, coop, youtube, alternates, last_updated);
    INSERT INTO @Results VALUES ('IX_games_cache_title_platform_release', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_cache_title_platform_release', 'Already Exists');

-- =============================================
-- Relationship Lookup Indexes
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_genres_game_id_genre_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_genres_game_id_genre_id
    ON games_genres(game_id, genre_id);
    INSERT INTO @Results VALUES ('IX_games_genres_game_id_genre_id', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_genres_game_id_genre_id', 'Already Exists');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_genres_genre_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_genres_genre_id
    ON games_genres(genre_id)
    INCLUDE (game_id);
    INSERT INTO @Results VALUES ('IX_games_genres_genre_id', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_genres_genre_id', 'Already Exists');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_developers_game_id_developer_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_developers_game_id_developer_id
    ON games_developers(game_id, developer_id);
    INSERT INTO @Results VALUES ('IX_games_developers_game_id_developer_id', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_developers_game_id_developer_id', 'Already Exists');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_developers_developer_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_developers_developer_id
    ON games_developers(developer_id)
    INCLUDE (game_id);
    INSERT INTO @Results VALUES ('IX_games_developers_developer_id', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_developers_developer_id', 'Already Exists');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_publishers_game_id_publisher_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_publishers_game_id_publisher_id
    ON games_publishers(game_id, publisher_id);
    INSERT INTO @Results VALUES ('IX_games_publishers_game_id_publisher_id', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_publishers_game_id_publisher_id', 'Already Exists');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_publishers_publisher_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_publishers_publisher_id
    ON games_publishers(publisher_id)
    INCLUDE (game_id);
    INSERT INTO @Results VALUES ('IX_games_publishers_publisher_id', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_publishers_publisher_id', 'Already Exists');

-- =============================================
-- Upcoming Games Index
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_cache_release_date_platform')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_cache_release_date_platform
    ON games_cache(release_date, platform)
    INCLUDE (game_title, region_id, players, overview, rating, coop, alternates);
    INSERT INTO @Results VALUES ('IX_games_cache_release_date_platform', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_cache_release_date_platform', 'Already Exists');

-- =============================================
-- Recommendations Query Index
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_cache_platform')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_cache_platform
    ON games_cache(platform)
    INCLUDE (game_id, game_title, release_date, region_id, players, overview, rating, coop);
    INSERT INTO @Results VALUES ('IX_games_cache_platform', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_cache_platform', 'Already Exists');

-- =============================================
-- Boxart Lookup Index
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_boxart_game_id_type_side')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_boxart_game_id_type_side
    ON games_boxart(game_id, type, side)
    INCLUDE (filename, resolution);
    INSERT INTO @Results VALUES ('IX_games_boxart_game_id_type_side', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_games_boxart_game_id_type_side', 'Already Exists');

-- =============================================
-- Lookup Tables Indexes (for JOINs)
-- =============================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lookup_genres_name')
BEGIN
    CREATE NONCLUSTERED INDEX IX_lookup_genres_name
    ON lookup_genres(name);
    INSERT INTO @Results VALUES ('IX_lookup_genres_name', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_lookup_genres_name', 'Already Exists');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lookup_developers_name')
BEGIN
    CREATE NONCLUSTERED INDEX IX_lookup_developers_name
    ON lookup_developers(name);
    INSERT INTO @Results VALUES ('IX_lookup_developers_name', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_lookup_developers_name', 'Already Exists');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lookup_publishers_name')
BEGIN
    CREATE NONCLUSTERED INDEX IX_lookup_publishers_name
    ON lookup_publishers(name);
    INSERT INTO @Results VALUES ('IX_lookup_publishers_name', 'Created');
END
ELSE
    INSERT INTO @Results VALUES ('IX_lookup_publishers_name', 'Already Exists');

-- =============================================
-- Statistics Update
-- =============================================

UPDATE STATISTICS games_cache WITH FULLSCAN;
UPDATE STATISTICS games_genres WITH FULLSCAN;
UPDATE STATISTICS games_developers WITH FULLSCAN;
UPDATE STATISTICS games_publishers WITH FULLSCAN;
UPDATE STATISTICS games_boxart WITH FULLSCAN;
UPDATE STATISTICS lookup_genres WITH FULLSCAN;
UPDATE STATISTICS lookup_developers WITH FULLSCAN;
UPDATE STATISTICS lookup_publishers WITH FULLSCAN;

INSERT INTO @Results VALUES ('Statistics Update', 'Completed');

-- =============================================
-- Display Results
-- =============================================

SELECT 
    Step,
    IndexName,
    Status,
    GETDATE() AS CompletedAt
FROM @Results
ORDER BY Step;

-- Summary
SELECT 
    Status,
    COUNT(*) AS Count
FROM @Results
GROUP BY Status
ORDER BY Status;
