namespace SwitchLibraryApi;

/// <summary>
/// Configuration settings for the nightly sync timer function
/// </summary>
public class SyncSettings
{
    /// <summary>
    /// Enable or disable the nightly sync timer (default: true)
    /// </summary>
    public bool SyncEnabled { get; set; } = true;

    /// <summary>
    /// Storage mode for sync operations (default: Dual)
    /// Dual mode maintains both blob (Azure Functions compatibility) and SQL (query performance)
    /// </summary>
    public GameSync.Core.StorageMode StorageMode { get; set; } = GameSync.Core.StorageMode.Dual;

    /// <summary>
    /// Auto-create SQL tables on startup if they don't exist (default: true)
    /// </summary>
    public bool EnableDatabaseInitialization { get; set; } = true;
}
