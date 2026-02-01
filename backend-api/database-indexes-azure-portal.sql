-- =============================================
-- Performance Indexes for Switch Library API
-- Azure Portal Compatible Version
-- =============================================
-- This script creates indexes to optimize common query patterns
-- Run this in Azure Portal Query Editor
-- =============================================

-- =============================================
-- Search Performance Indexes
-- =============================================

-- Index for game title searches (LIKE queries)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_cache_title_platform_release')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_cache_title_platform_release
    ON games_cache(game_title, platform, release_date)
    INCLUDE (region_id, players, overview, rating, coop, youtube, alternates, last_updated);
    PRINT 'Created IX_games_cache_title_platform_release';
END
GO

-- =============================================
-- Relationship Lookup Indexes
-- =============================================

-- Index for genres relationship lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_genres_game_id_genre_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_genres_game_id_genre_id
    ON games_genres(game_id, genre_id);
    PRINT 'Created IX_games_genres_game_id_genre_id';
END
GO

-- Additional covering index for genres with name
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_genres_genre_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_genres_genre_id
    ON games_genres(genre_id)
    INCLUDE (game_id);
    PRINT 'Created IX_games_genres_genre_id';
END
GO

-- Index for developers relationship lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_developers_game_id_developer_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_developers_game_id_developer_id
    ON games_developers(game_id, developer_id);
    PRINT 'Created IX_games_developers_game_id_developer_id';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_developers_developer_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_developers_developer_id
    ON games_developers(developer_id)
    INCLUDE (game_id);
    PRINT 'Created IX_games_developers_developer_id';
END
GO

-- Index for publishers relationship lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_publishers_game_id_publisher_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_publishers_game_id_publisher_id
    ON games_publishers(game_id, publisher_id);
    PRINT 'Created IX_games_publishers_game_id_publisher_id';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_publishers_publisher_id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_publishers_publisher_id
    ON games_publishers(publisher_id)
    INCLUDE (game_id);
    PRINT 'Created IX_games_publishers_publisher_id';
END
GO

-- =============================================
-- Upcoming Games Index
-- =============================================

-- Index for upcoming games query (release date filter)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_cache_release_date_platform')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_cache_release_date_platform
    ON games_cache(release_date, platform)
    INCLUDE (game_title, region_id, players, overview, rating, coop, alternates);
    PRINT 'Created IX_games_cache_release_date_platform';
END
GO

-- =============================================
-- Recommendations Query Index
-- =============================================

-- Index for recommendations by platform
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_cache_platform')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_cache_platform
    ON games_cache(platform)
    INCLUDE (game_id, game_title, release_date, region_id, players, overview, rating, coop);
    PRINT 'Created IX_games_cache_platform';
END
GO

-- =============================================
-- Boxart Lookup Index
-- =============================================

-- Index for boxart lookups (front cover)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_games_boxart_game_id_type_side')
BEGIN
    CREATE NONCLUSTERED INDEX IX_games_boxart_game_id_type_side
    ON games_boxart(game_id, type, side)
    INCLUDE (filename, resolution);
    PRINT 'Created IX_games_boxart_game_id_type_side';
END
GO

-- =============================================
-- Lookup Tables Indexes (for JOINs)
-- =============================================

-- Index for lookup_genres name sorting
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lookup_genres_name')
BEGIN
    CREATE NONCLUSTERED INDEX IX_lookup_genres_name
    ON lookup_genres(name);
    PRINT 'Created IX_lookup_genres_name';
END
GO

-- Index for lookup_developers name sorting
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lookup_developers_name')
BEGIN
    CREATE NONCLUSTERED INDEX IX_lookup_developers_name
    ON lookup_developers(name);
    PRINT 'Created IX_lookup_developers_name';
END
GO

-- Index for lookup_publishers name sorting
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lookup_publishers_name')
BEGIN
    CREATE NONCLUSTERED INDEX IX_lookup_publishers_name
    ON lookup_publishers(name);
    PRINT 'Created IX_lookup_publishers_name';
END
GO

-- =============================================
-- Statistics Update
-- =============================================

-- Update statistics for all tables to ensure query optimizer has fresh data
UPDATE STATISTICS games_cache WITH FULLSCAN;
UPDATE STATISTICS games_genres WITH FULLSCAN;
UPDATE STATISTICS games_developers WITH FULLSCAN;
UPDATE STATISTICS games_publishers WITH FULLSCAN;
UPDATE STATISTICS games_boxart WITH FULLSCAN;
UPDATE STATISTICS lookup_genres WITH FULLSCAN;
UPDATE STATISTICS lookup_developers WITH FULLSCAN;
UPDATE STATISTICS lookup_publishers WITH FULLSCAN;
GO

PRINT 'All performance indexes created successfully!';
PRINT 'Run this script periodically or after significant data changes.';
GO
