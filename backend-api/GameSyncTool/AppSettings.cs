namespace GameSyncTool;

public class AppSettings
{
    public TheGamesDBSettings TheGamesDB { get; set; } = new();
    public BlobStorageSettings BlobStorage { get; set; } = new();
    public SqlDatabaseSettings SqlDatabase { get; set; } = new();
    public PlatformsSettings Platforms { get; set; } = new();
    public StorageMode StorageMode { get; set; } = StorageMode.Blob;
}

public enum StorageMode
{
    /// <summary>Azure Blob Storage only (default, current implementation)</summary>
    Blob,
    
    /// <summary>Azure SQL Database only</summary>
    SqlDatabase,
    
    /// <summary>Both Blob and SQL Database (dual write mode)</summary>
    Dual
}

public class TheGamesDBSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.thegamesdb.net/";
    public int Version { get; set; } = 1;
}

public class BlobStorageSettings
{
    public string ConnectionString { get; set; } = string.Empty;
    public string ContainerName { get; set; } = "games-cache";
}

public class SqlDatabaseSettings
{
    public string ConnectionString { get; set; } = string.Empty;
    public string DatabaseName { get; set; } = "switchlibrary-games";
    public int CommandTimeout { get; set; } = 30;
    public bool EnableRetryOnFailure { get; set; } = true;
}

public class PlatformsSettings
{
    public int NintendoSwitch { get; set; } = 4971;
    public int NintendoSwitch2 { get; set; } = 5021;
}
