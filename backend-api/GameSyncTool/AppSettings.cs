namespace GameSyncTool;

public class AppSettings
{
    public TheGamesDBSettings TheGamesDB { get; set; } = new();
    public BlobStorageSettings BlobStorage { get; set; } = new();
    public PlatformsSettings Platforms { get; set; } = new();
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

public class PlatformsSettings
{
    public int NintendoSwitch { get; set; } = 4918;
    public int NintendoSwitch2 { get; set; } = 4950;
}
