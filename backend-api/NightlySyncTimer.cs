using Azure.Storage.Blobs;
using GameSync.Core;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;

namespace SwitchLibraryApi;

/// <summary>
/// Azure Functions timer trigger that performs nightly sync of game data from TheGamesDB API
/// </summary>
public class NightlySyncTimer
{
    private readonly GameSyncService _syncService;
    private readonly ILogger<NightlySyncTimer> _logger;
    private readonly SyncSettings _syncSettings;
    private readonly BlobServiceClient? _blobServiceClient;
    private const string SyncLogsContainer = "sync-logs";

    public NightlySyncTimer(
        GameSyncService syncService,
        ILogger<NightlySyncTimer> logger,
        IConfiguration configuration)
    {
        _syncService = syncService;
        _logger = logger;
        
        // Initialize blob client for sync logs
        var blobConnectionString = configuration["ProductionStorage"];
        if (!string.IsNullOrEmpty(blobConnectionString))
        {
            _blobServiceClient = new BlobServiceClient(blobConnectionString);
        }
        
        // Bind sync settings from configuration with smart defaults
        _syncSettings = new SyncSettings();
        configuration.GetSection("Sync").Bind(_syncSettings);
        
        // Smart defaults: SyncEnabled = true, StorageMode = Dual
        _syncSettings.SyncEnabled = configuration.GetValue<bool>("SyncEnabled", true);
        
        // Parse StorageMode with Dual as default
        var storageModeConfig = configuration["StorageMode"];
        if (!string.IsNullOrEmpty(storageModeConfig))
        {
            if (Enum.TryParse<StorageMode>(storageModeConfig, ignoreCase: true, out var mode))
            {
                _syncSettings.StorageMode = mode;
            }
        }
        // If not set in config, defaults to Dual (from SyncSettings class default)
    }

    /// <summary>
    /// Timer trigger that runs daily at 2 AM UTC
    /// Performs incremental sync of game data from TheGamesDB API
    /// </summary>
    /// <param name="timerInfo">Timer execution context</param>
    [Function("NightlySyncTimer")]
    public async Task Run(
        [TimerTrigger("0 0 2 * * *", RunOnStartup = false)] TimerInfo timerInfo)
    {
        // Check if sync is enabled
        if (!_syncSettings.SyncEnabled)
        {
            _logger.LogInformation("Nightly sync is disabled via configuration. Skipping execution.");
            return;
        }

        var startTime = DateTime.UtcNow;
        _logger.LogInformation("=================================================");
        _logger.LogInformation("Nightly sync started at {StartTime} UTC", startTime);
        _logger.LogInformation("Storage Mode: {StorageMode}", _syncSettings.StorageMode);
        _logger.LogInformation("Next sync scheduled for: {NextRun}", timerInfo.ScheduleStatus?.Next);
        _logger.LogInformation("=================================================");

        try
        {
            // Perform incremental sync (updates only, not full sync)
            var syncResult = await _syncService.SyncUpdatesAsync();

            // Also sync missing boxart after incremental updates
            var boxartUpdatedCount = await _syncService.SyncMissingBoxartAsync(interactiveMode: false);

            var endTime = DateTime.UtcNow;
            var duration = endTime - startTime;

            // Get statistics to report sync results
            var stats = await _syncService.GetStatisticsAsync();

            _logger.LogInformation("=================================================");
            _logger.LogInformation("Nightly sync completed successfully at {EndTime} UTC", endTime);
            _logger.LogInformation("Duration: {Duration:hh\\:mm\\:ss}", duration);
            _logger.LogInformation("Games processed this sync: {Processed} ({New} new, {Updated} updated)",
                syncResult.TotalProcessed, syncResult.NewGamesAdded, syncResult.GamesUpdated);
            _logger.LogInformation("Boxart updated this sync: {BoxartUpdatedCount}", boxartUpdatedCount);
            _logger.LogInformation("  - Nintendo Switch: {SwitchCount} games", syncResult.SwitchGamesProcessed);
            _logger.LogInformation("  - Nintendo Switch 2: {Switch2Count} games", syncResult.Switch2GamesProcessed);
            _logger.LogInformation("Total games cached: {GameCount}", stats.TotalGamesCached);
            
            if (_syncSettings.StorageMode == StorageMode.Dual)
            {
                _logger.LogInformation("  - Blob storage: {BlobCount} games", stats.BlobGameCount ?? 0);
                _logger.LogInformation("  - SQL database: {SqlCount} games", stats.SqlGameCount ?? 0);
            }
            
            _logger.LogInformation("Lookup data: Genres={GenreCount}, Developers={DeveloperCount}, Publishers={PublisherCount}",
                stats.GenreCount, stats.DeveloperCount, stats.PublisherCount);
            _logger.LogInformation("Last sync time: {LastSync}", stats.LastSyncTime);
            _logger.LogInformation("=================================================");

            // Write success log to blob storage
            await WriteSyncLogAsync(new SyncLogEntry
            {
                Timestamp = endTime,
                Status = "Success",
                StartTime = startTime,
                EndTime = endTime,
                DurationSeconds = duration.TotalSeconds,
                StorageMode = _syncSettings.StorageMode.ToString(),
                GamesProcessed = syncResult.TotalProcessed,
                NewGamesAdded = syncResult.NewGamesAdded,
                GamesUpdated = syncResult.GamesUpdated,
                BoxartUpdated = boxartUpdatedCount,
                SwitchGamesProcessed = syncResult.SwitchGamesProcessed,
                Switch2GamesProcessed = syncResult.Switch2GamesProcessed,
                TotalGamesCached = stats.TotalGamesCached,
                BlobGameCount = stats.BlobGameCount,
                SqlGameCount = stats.SqlGameCount,
                GenreCount = stats.GenreCount,
                DeveloperCount = stats.DeveloperCount,
                PublisherCount = stats.PublisherCount,
                LastSyncTime = stats.LastSyncTime
            });
        }
        catch (Exception ex)
        {
            var endTime = DateTime.UtcNow;
            var duration = endTime - startTime;

            _logger.LogError(ex, "=================================================");
            _logger.LogError(ex, "Nightly sync FAILED at {EndTime} UTC", endTime);
            _logger.LogError(ex, "Duration before failure: {Duration:hh\\:mm\\:ss}", duration);
            _logger.LogError(ex, "Error: {ErrorMessage}", ex.Message);
            _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
            _logger.LogError(ex, "=================================================");

            // Write failure log to blob storage
            await WriteSyncLogAsync(new SyncLogEntry
            {
                Timestamp = endTime,
                Status = "Failed",
                StartTime = startTime,
                EndTime = endTime,
                DurationSeconds = duration.TotalSeconds,
                StorageMode = _syncSettings.StorageMode.ToString(),
                ErrorMessage = ex.Message,
                StackTrace = ex.StackTrace
            });

            // Re-throw to mark the function execution as failed in Application Insights
            // This will trigger alerts if configured
            throw;
        }
    }

    /// <summary>
    /// Write sync log entry to blob storage
    /// </summary>
    private async Task WriteSyncLogAsync(SyncLogEntry logEntry)
    {
        if (_blobServiceClient == null)
        {
            _logger.LogWarning("Blob storage not configured, skipping sync log write");
            return;
        }

        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(SyncLogsContainer);
            await containerClient.CreateIfNotExistsAsync();

            // Create blob name with date-based path for easy organization: sync-logs/2026/02/01/sync-20260201-143408.json
            var blobName = $"{logEntry.Timestamp:yyyy}/{logEntry.Timestamp:MM}/{logEntry.Timestamp:dd}/sync-{logEntry.Timestamp:yyyyMMdd-HHmmss}.json";
            var blobClient = containerClient.GetBlobClient(blobName);

            var json = JsonSerializer.Serialize(logEntry, new JsonSerializerOptions 
            { 
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
            await blobClient.UploadAsync(stream, overwrite: true);

            _logger.LogInformation("Sync log written to blob: {BlobName}", blobName);
        }
        catch (Exception ex)
        {
            // Don't fail the sync if logging fails
            _logger.LogWarning(ex, "Failed to write sync log to blob storage: {Error}", ex.Message);
        }
    }
}

/// <summary>
/// Timer execution context from Azure Functions
/// </summary>
public class TimerInfo
{
    public TimerScheduleStatus? ScheduleStatus { get; set; }
    public bool IsPastDue { get; set; }
}

/// <summary>
/// Timer schedule status
/// </summary>
public class TimerScheduleStatus
{
    public DateTime Last { get; set; }
    public DateTime Next { get; set; }
    public DateTime LastUpdated { get; set; }
}

/// <summary>
/// Sync log entry written to blob storage for tracking sync history
/// </summary>
public class SyncLogEntry
{
    public DateTime Timestamp { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public double DurationSeconds { get; set; }
    public string StorageMode { get; set; } = string.Empty;
    
    // Sync operation results
    public int GamesProcessed { get; set; }
    public int NewGamesAdded { get; set; }
    public int GamesUpdated { get; set; }
    public int BoxartUpdated { get; set; }
    public int SwitchGamesProcessed { get; set; }
    public int Switch2GamesProcessed { get; set; }
    
    // Cache statistics
    public int TotalGamesCached { get; set; }
    public int? BlobGameCount { get; set; }
    public int? SqlGameCount { get; set; }
    public int GenreCount { get; set; }
    public int DeveloperCount { get; set; }
    public int PublisherCount { get; set; }
    public DateTime? LastSyncTime { get; set; }
    
    // Error information (for failed syncs)
    public string? ErrorMessage { get; set; }
    public string? StackTrace { get; set; }
}
