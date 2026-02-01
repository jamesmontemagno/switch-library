-- =============================================
-- Index Validation Query
-- Run this in Azure Portal to verify all indexes exist
-- =============================================

-- List of expected indexes
DECLARE @ExpectedIndexes TABLE (
    TableName NVARCHAR(100),
    IndexName NVARCHAR(200),
    Purpose NVARCHAR(500)
);

-- Results tracking
DECLARE @ValidationResults TABLE (
    Step INT IDENTITY(1,1),
    TableName NVARCHAR(100),
    IndexName NVARCHAR(200),
    Status NVARCHAR(50),
    Details NVARCHAR(500)
);

INSERT INTO @ExpectedIndexes VALUES
    ('games_cache', 'IX_games_cache_title_platform_release', 'Search performance - title searches with LIKE queries'),
    ('games_genres', 'IX_games_genres_game_id_genre_id', 'Relationship lookups - genres by game'),
    ('games_genres', 'IX_games_genres_genre_id', 'Relationship lookups - games by genre (covering index)'),
    ('games_developers', 'IX_games_developers_game_id_developer_id', 'Relationship lookups - developers by game'),
    ('games_developers', 'IX_games_developers_developer_id', 'Relationship lookups - games by developer (covering index)'),
    ('games_publishers', 'IX_games_publishers_game_id_publisher_id', 'Relationship lookups - publishers by game'),
    ('games_publishers', 'IX_games_publishers_publisher_id', 'Relationship lookups - games by publisher (covering index)'),
    ('games_cache', 'IX_games_cache_release_date_platform', 'Upcoming games query - release date filter'),
    ('games_cache', 'IX_games_cache_platform', 'Recommendations query - platform filter'),
    ('games_boxart', 'IX_games_boxart_game_id_type_side', 'Boxart lookups - front cover retrieval'),
    ('lookup_genres', 'IX_lookup_genres_name', 'Lookup table - genre name sorting'),
    ('lookup_developers', 'IX_lookup_developers_name', 'Lookup table - developer name sorting'),
    ('lookup_publishers', 'IX_lookup_publishers_name', 'Lookup table - publisher name sorting');

-- Validate each index
INSERT INTO @ValidationResults (TableName, IndexName, Status, Details)
SELECT 
    e.TableName,
    e.IndexName,
    CASE 
        WHEN i.name IS NOT NULL AND i.is_disabled = 0 THEN 'EXISTS'
        WHEN i.name IS NOT NULL AND i.is_disabled = 1 THEN 'DISABLED'
        ELSE 'MISSING' 
    END,
    e.Purpose
FROM @ExpectedIndexes e
LEFT JOIN sys.indexes i 
    ON i.name = e.IndexName 
    AND OBJECT_NAME(i.object_id) = e.TableName;

-- =============================================
-- Display Results - Detailed Status
-- =============================================
SELECT 
    Step,
    TableName,
    IndexName,
    Status,
    Details,
    GETDATE() AS CheckedAt
FROM @ValidationResults
ORDER BY 
    CASE 
        WHEN Status = 'MISSING' THEN 1
        WHEN Status = 'DISABLED' THEN 2
        ELSE 3
    END,
    Step;

-- =============================================
-- Display Results - Summary
-- =============================================
SELECT 
    Status,
    COUNT(*) AS [Count]
FROM @ValidationResults
GROUP BY Status
ORDER BY Status;
