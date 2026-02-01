using GameSync.Core;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace SwitchLibraryApi;

/// <summary>
/// Azure Functions timer trigger that performs nightly sync of game data from TheGamesDB API
/// </summary>
public class NightlySyncTimer
{
    private readonly GameSyncService _syncService;
    private readonly ILogger<NightlySyncTimer> _logger;
    private readonly SyncSettings _syncSettings;

    public NightlySyncTimer(
        GameSyncService syncService,
        ILogger<NightlySyncTimer> logger,
        IConfiguration configuration)
    {
        _syncService = syncService;
        _logger = logger;
        
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
            await _syncService.SyncUpdatesAsync();

            var endTime = DateTime.UtcNow;
            var duration = endTime - startTime;

            // Get statistics to report sync results
            var stats = await _syncService.GetStatisticsAsync();

            _logger.LogInformation("=================================================");
            _logger.LogInformation("Nightly sync completed successfully at {EndTime} UTC", endTime);
            _logger.LogInformation("Duration: {Duration:hh\\:mm\\:ss}", duration);
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

            // Re-throw to mark the function execution as failed in Application Insights
            // This will trigger alerts if configured
            throw;
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
