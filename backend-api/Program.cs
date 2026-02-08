using Azure.Storage.Blobs;
using GameSync.Core;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SwitchLibraryApi;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

// Note: Response compression in Azure Functions is handled by the Azure infrastructure
// For custom compression, consider using a middleware approach or rely on Azure's built-in compression

// Add in-memory caching for SQL query results
builder.Services.AddMemoryCache();

// Add HttpClient for proxying requests and TheGamesDB API calls (sync only)
builder.Services.AddHttpClient();

// Register SqlGameService for SQL database queries (primary data source for user queries)
builder.Services.AddScoped<SqlGameService>();

// Configure Application Insights
builder.Services
    .AddApplicationInsightsTelemetryWorkerService()
    .ConfigureFunctionsApplicationInsights();

// Register GameSyncService and its dependencies for nightly sync timer
builder.Services.AddScoped<GameSyncService>(sp =>
{
    var httpClient = sp.GetRequiredService<IHttpClientFactory>().CreateClient();
    var configuration = sp.GetRequiredService<IConfiguration>();
    var logger = sp.GetRequiredService<ILogger<GameSyncService>>();

    // Bind settings from configuration
    var gamesDbSettings = new TheGamesDBSettings();
    configuration.GetSection("TheGamesDB").Bind(gamesDbSettings);
    if (string.IsNullOrEmpty(gamesDbSettings.ApiKey))
    {
        gamesDbSettings.ApiKey = configuration["TheGamesDB__ApiKey"] ?? "";
    }

    var blobSettings = new BlobStorageSettings();
    configuration.GetSection("BlobStorage").Bind(blobSettings);
    if (string.IsNullOrEmpty(blobSettings.ConnectionString))
    {
        // Use ProductionStorage for consistency with other API functions (GetGameById, GetGamesByIds, TheGamesDbProxy)
        blobSettings.ConnectionString = configuration["ProductionStorage"] ?? "UseDevelopmentStorage=true";
    }
    if (string.IsNullOrEmpty(blobSettings.ContainerName))
    {
        blobSettings.ContainerName = configuration["BlobStorage__ContainerName"] ?? "games-cache";
    }

    var sqlSettings = new SqlDatabaseSettings();
    configuration.GetSection("SqlDatabase").Bind(sqlSettings);
    if (string.IsNullOrEmpty(sqlSettings.ConnectionString))
    {
        sqlSettings.ConnectionString = configuration["SqlDatabase__ConnectionString"] ?? "";
    }
    if (string.IsNullOrEmpty(sqlSettings.DatabaseName))
    {
        sqlSettings.DatabaseName = configuration["SqlDatabase__DatabaseName"] ?? "switchlibrary-games";
    }

    var platformSettings = new PlatformsSettings();
    configuration.GetSection("Platforms").Bind(platformSettings);
    if (platformSettings.NintendoSwitch == 0)
    {
        platformSettings.NintendoSwitch = configuration.GetValue<int>("Platforms__NintendoSwitch", 4971);
    }
    if (platformSettings.NintendoSwitch2 == 0)
    {
        platformSettings.NintendoSwitch2 = configuration.GetValue<int>("Platforms__NintendoSwitch2", 5021);
    }

    // Determine storage mode
    var storageMode = StorageMode.Dual; // Default to Dual mode
    var storageModeConfig = configuration["StorageMode"];
    if (!string.IsNullOrEmpty(storageModeConfig))
    {
        Enum.TryParse<StorageMode>(storageModeConfig, out storageMode);
    }

    return new GameSyncService(
        httpClient,
        gamesDbSettings,
        blobSettings,
        sqlSettings,
        platformSettings,
        storageMode,
        logger
    );
});

// Register DatabaseInitializer for SQL schema management
builder.Services.AddScoped<DatabaseInitializer>(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var logger = sp.GetRequiredService<ILogger<DatabaseInitializer>>();

    var sqlSettings = new SqlDatabaseSettings();
    configuration.GetSection("SqlDatabase").Bind(sqlSettings);
    if (string.IsNullOrEmpty(sqlSettings.ConnectionString))
    {
        sqlSettings.ConnectionString = configuration["SqlDatabase__ConnectionString"] ?? "";
    }

    return new DatabaseInitializer(sqlSettings, logger);
});

var host = builder.Build();

// Initialize database schema if SQL mode is enabled
using (var scope = host.Services.CreateScope())
{
    var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var storageMode = configuration["StorageMode"];
    var enableDbInit = configuration.GetValue<bool>("Sync:EnableDatabaseInitialization", true);
    
    // Initialize if using SqlDatabase or Dual mode
    if (enableDbInit && (storageMode == "SqlDatabase" || storageMode == "Dual"))
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        var dbInitializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
        
        try
        {
            logger.LogInformation("Initializing database schema for storage mode: {StorageMode}", storageMode);
            await dbInitializer.EnsureDatabaseAsync();
            logger.LogInformation("Database schema initialization completed");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Database initialization failed. This is expected if SQL is not configured.");
        }
    }
}

host.Run();
