-- Switch Library Game Sync Tool - Azure SQL Database Schema
-- Execute this script against your Azure SQL Database to create the required tables
-- Database: switchlibrary-games

-- =============================================
-- Games Cache (Main Table)
-- =============================================
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
    alternates NVARCHAR(MAX),  -- JSON array of alternate titles
    cached_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    INDEX IX_games_cache_platform (platform),
    INDEX IX_games_cache_release_date (release_date),
    INDEX IX_games_cache_last_updated (last_updated)
);
GO

-- Create full-text catalog and index for fuzzy search
CREATE FULLTEXT CATALOG ft_games_catalog AS DEFAULT;
GO

CREATE FULLTEXT INDEX ON games_cache(game_title, overview)
    KEY INDEX PK__games_ca__3D9D9CC2F8F8F8F8  -- Replace with actual PK constraint name after table creation
    WITH STOPLIST = SYSTEM;
GO

-- =============================================
-- Boxart (One-to-Many with Games)
-- =============================================
CREATE TABLE games_boxart (
    id INT PRIMARY KEY,
    game_id INT NOT NULL,
    type NVARCHAR(50),
    side NVARCHAR(20),
    filename NVARCHAR(500),
    resolution NVARCHAR(50),
    CONSTRAINT FK_boxart_game FOREIGN KEY (game_id) 
        REFERENCES games_cache(game_id) ON DELETE CASCADE,
    INDEX IX_boxart_game_id (game_id)
);
GO

-- =============================================
-- Lookup Tables
-- =============================================
CREATE TABLE lookup_genres (
    genre_id INT PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    cached_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE TABLE lookup_developers (
    developer_id INT PRIMARY KEY,
    name NVARCHAR(500) NOT NULL,
    cached_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE TABLE lookup_publishers (
    publisher_id INT PRIMARY KEY,
    name NVARCHAR(500) NOT NULL,
    cached_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
GO

-- =============================================
-- Junction Tables (Many-to-Many Relationships)
-- =============================================
CREATE TABLE games_genres (
    game_id INT NOT NULL,
    genre_id INT NOT NULL,
    PRIMARY KEY (game_id, genre_id),
    CONSTRAINT FK_games_genres_game FOREIGN KEY (game_id) 
        REFERENCES games_cache(game_id) ON DELETE CASCADE,
    CONSTRAINT FK_games_genres_genre FOREIGN KEY (genre_id) 
        REFERENCES lookup_genres(genre_id) ON DELETE CASCADE,
    INDEX IX_games_genres_genre_id (genre_id)
);
GO

CREATE TABLE games_developers (
    game_id INT NOT NULL,
    developer_id INT NOT NULL,
    PRIMARY KEY (game_id, developer_id),
    CONSTRAINT FK_games_developers_game FOREIGN KEY (game_id) 
        REFERENCES games_cache(game_id) ON DELETE CASCADE,
    CONSTRAINT FK_games_developers_developer FOREIGN KEY (developer_id) 
        REFERENCES lookup_developers(developer_id) ON DELETE CASCADE,
    INDEX IX_games_developers_developer_id (developer_id)
);
GO

CREATE TABLE games_publishers (
    game_id INT NOT NULL,
    publisher_id INT NOT NULL,
    PRIMARY KEY (game_id, publisher_id),
    CONSTRAINT FK_games_publishers_game FOREIGN KEY (game_id) 
        REFERENCES games_cache(game_id) ON DELETE CASCADE,
    CONSTRAINT FK_games_publishers_publisher FOREIGN KEY (publisher_id) 
        REFERENCES lookup_publishers(publisher_id) ON DELETE CASCADE,
    INDEX IX_games_publishers_publisher_id (publisher_id)
);
GO

-- =============================================
-- Sync Metadata (replaces last-sync.txt)
-- =============================================
CREATE TABLE sync_metadata (
    id INT PRIMARY KEY DEFAULT 1,
    last_sync_time DATETIME2 NOT NULL,
    sync_type NVARCHAR(50),  -- 'full' or 'incremental'
    games_synced INT DEFAULT 0,
    CONSTRAINT CHK_sync_metadata_single_row CHECK (id = 1)  -- Only one row allowed
);
GO

-- Insert initial row
INSERT INTO sync_metadata (id, last_sync_time, sync_type) 
VALUES (1, '1900-01-01', 'none');
GO

-- =============================================
-- Platform Metadata (from API response)
-- =============================================
CREATE TABLE platforms (
    platform_id INT PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    alias NVARCHAR(200)
);
GO

-- Insert known platforms
INSERT INTO platforms (platform_id, name, alias) VALUES
(4971, 'Nintendo Switch', 'switch'),
(5021, 'Nintendo Switch 2', 'switch2');
GO

-- =============================================
-- Helper Views for Queries
-- =============================================

-- View: Games with all related data joined
CREATE VIEW vw_games_complete AS
SELECT 
    g.game_id,
    g.game_title,
    g.release_date,
    g.platform,
    p.name AS platform_name,
    g.region_id,
    g.country_id,
    g.players,
    g.overview,
    g.last_updated,
    g.rating,
    g.coop,
    g.youtube,
    g.alternates,
    g.cached_at,
    -- Aggregate genres
    (SELECT STRING_AGG(lg.name, ', ') 
     FROM games_genres gg 
     JOIN lookup_genres lg ON gg.genre_id = lg.genre_id 
     WHERE gg.game_id = g.game_id) AS genres,
    -- Aggregate developers
    (SELECT STRING_AGG(ld.name, ', ') 
     FROM games_developers gd 
     JOIN lookup_developers ld ON gd.developer_id = ld.developer_id 
     WHERE gd.game_id = g.game_id) AS developers,
    -- Aggregate publishers
    (SELECT STRING_AGG(lp.name, ', ') 
     FROM games_publishers gp 
     JOIN lookup_publishers lp ON gp.publisher_id = lp.publisher_id 
     WHERE gp.game_id = g.game_id) AS publishers
FROM games_cache g
LEFT JOIN platforms p ON g.platform = p.platform_id;
GO

-- =============================================
-- Useful Queries for Testing
-- =============================================

-- Count games by platform
-- SELECT platform, COUNT(*) as game_count FROM games_cache GROUP BY platform;

-- Search for games (fuzzy)
-- SELECT * FROM games_cache WHERE CONTAINS(game_title, 'zelda OR "legend of zelda"');

-- Upcoming releases
-- SELECT * FROM games_cache WHERE release_date > GETDATE() ORDER BY release_date;

-- Games by genre
-- SELECT g.* FROM games_cache g
-- JOIN games_genres gg ON g.game_id = gg.game_id
-- JOIN lookup_genres lg ON gg.genre_id = lg.genre_id
-- WHERE lg.name = 'Action';

-- Get sync statistics
-- SELECT 
--     last_sync_time, 
--     sync_type,
--     (SELECT COUNT(*) FROM games_cache) as total_games,
--     (SELECT COUNT(*) FROM lookup_genres) as total_genres,
--     (SELECT COUNT(*) FROM lookup_developers) as total_developers,
--     (SELECT COUNT(*) FROM lookup_publishers) as total_publishers
-- FROM sync_metadata;
