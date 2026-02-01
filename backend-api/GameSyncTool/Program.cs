using GameSyncTool;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

class Program
{
    static async Task<int> Main(string[] args)
    {
        Console.WriteLine("===========================================");
        Console.WriteLine("Switch Library - Game Sync Tool");
        Console.WriteLine("===========================================");
        Console.WriteLine();

        try
        {
            // Build configuration
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                .AddEnvironmentVariables()
                .AddCommandLine(args)
                .Build();

            var appSettings = configuration.Get<AppSettings>() ?? new AppSettings();

            // Validate configuration
            if (string.IsNullOrWhiteSpace(appSettings.TheGamesDB.ApiKey))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Error: TheGamesDB API Key is not configured!");
                Console.ResetColor();
                Console.WriteLine("Please set it in appsettings.json or via command line:");
                Console.WriteLine("  --TheGamesDB:ApiKey=YOUR_API_KEY");
                Console.WriteLine();
                return 1;
            }

            if (string.IsNullOrWhiteSpace(appSettings.BlobStorage.ConnectionString))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Error: Blob Storage Connection String is not configured!");
                Console.ResetColor();
                Console.WriteLine("Please set it in appsettings.json or via command line:");
                Console.WriteLine("  --BlobStorage:ConnectionString=YOUR_CONNECTION_STRING");
                Console.WriteLine();
                return 1;
            }

            // Setup dependency injection
            var services = new ServiceCollection();
            ConfigureServices(services, appSettings, configuration);
            var serviceProvider = services.BuildServiceProvider();

            // Initialize database schema if using SQL storage
            if (appSettings.StorageMode == StorageMode.SqlDatabase || appSettings.StorageMode == StorageMode.Dual)
            {
                var dbInitializer = serviceProvider.GetRequiredService<DatabaseInitializer>();
                await dbInitializer.EnsureDatabaseAsync();
            }

            // Get the sync service
            var syncService = serviceProvider.GetRequiredService<GameSyncService>();

            // Parse command line arguments
            var mode = GetCommandLineArgument(args, "--mode") ?? 
                      GetCommandLineArgument(args, "-m");

            if (string.IsNullOrEmpty(mode))
            {
                // Interactive mode
                return await RunInteractiveModeAsync(syncService, appSettings.Platforms);
            }
            else
            {
                // Non-interactive mode
                return await RunNonInteractiveModeAsync(syncService, mode, args, serviceProvider);
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Fatal error: {ex.Message}");
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine("Stack trace:");
            Console.WriteLine(ex.StackTrace);
            return 1;
        }
    }

    static void ConfigureServices(IServiceCollection services, AppSettings appSettings, IConfiguration configuration)
    {
        // Create log file path with timestamp
        var logFileName = $"gamesync-{DateTime.UtcNow:yyyyMMdd-HHmmss}.log";
        var logFilePath = Path.Combine("logs", logFileName);
        
        // Add logging
        services.AddLogging(builder =>
        {
            builder.AddConfiguration(configuration.GetSection("Logging"));
            builder.AddConsole();
            builder.AddProvider(new FileLoggerProvider(logFilePath));
        });

        Console.WriteLine($"Logging to file: {Path.GetFullPath(logFilePath)}");
        Console.WriteLine();

        // Add HttpClient with increased timeout for API calls
        services.AddHttpClient<GameSyncService>(client =>
        {
            client.Timeout = TimeSpan.FromMinutes(5); // Increase timeout to 5 minutes
        });

        // Add settings
        services.AddSingleton(appSettings.TheGamesDB);
        services.AddSingleton(appSettings.BlobStorage);
        services.AddSingleton(appSettings.SqlDatabase);
        services.AddSingleton(appSettings.Platforms);

        // Add database initializer
        services.AddSingleton<DatabaseInitializer>();

        // Add sync service with storage mode
        services.AddSingleton<GameSyncService>(sp => new GameSyncService(
            sp.GetRequiredService<HttpClient>(),
            sp.GetRequiredService<TheGamesDBSettings>(),
            sp.GetRequiredService<BlobStorageSettings>(),
            sp.GetRequiredService<SqlDatabaseSettings>(),
            sp.GetRequiredService<PlatformsSettings>(),
            appSettings.StorageMode,
            sp.GetRequiredService<ILogger<GameSyncService>>()
        ));
        
        // Log storage mode
        Console.WriteLine($"Storage Mode: {appSettings.StorageMode}");
        if (appSettings.StorageMode == StorageMode.SqlDatabase || appSettings.StorageMode == StorageMode.Dual)
        {
            if (string.IsNullOrWhiteSpace(appSettings.SqlDatabase.ConnectionString))
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("Warning: SQL Database storage mode selected but connection string is not configured!");
                Console.ResetColor();
            }
            else
            {
                Console.WriteLine("SQL Database: Configured");
            }
        }
        Console.WriteLine();
    }

    static async Task<int> RunInteractiveModeAsync(GameSyncService syncService, PlatformsSettings platformSettings)
    {
        Console.WriteLine("Running in INTERACTIVE mode");
        Console.WriteLine();

        while (true)
        {
            Console.WriteLine("===========================================");
            Console.WriteLine("Main Menu:");
            Console.WriteLine("===========================================");
        Console.WriteLine("1. Full Sync - Sync all games and lookup data");
        Console.WriteLine("2. Sync Games Only - Sync games without lookup data");
        Console.WriteLine("3. Incremental Sync - Sync only updates");
        Console.WriteLine("4. Sync Genres only");
        Console.WriteLine("5. Sync Developers only");
        Console.WriteLine("6. Sync Publishers only");
        Console.WriteLine("7. Show Statistics");
        Console.WriteLine("8. Exit");
        Console.WriteLine();
        Console.Write("Select an option (1-8): ");

            var choice = Console.ReadLine()?.Trim();
            Console.WriteLine();

            switch (choice)
            {
                case "1":
                    await PerformFullSyncAsync(syncService, interactiveMode: true, platformSettings, forcedStartPage: 0);
                    break;

                case "2":
                    await PerformFullSyncAsync(syncService, interactiveMode: true, platformSettings, forcedStartPage: 0, gamesOnly: true);
                    break;

                case "3":
                    await PerformIncrementalSyncAsync(syncService);
                    break;

                case "4":
                    await SyncGenresOnlyAsync(syncService);
                    break;

                case "5":
                    await SyncDevelopersOnlyAsync(syncService);
                    break;

                case "6":
                    await SyncPublishersOnlyAsync(syncService);
                    break;

                case "7":
                    await ShowStatisticsAsync(syncService);
                    break;

                case "8":
                    Console.WriteLine("Goodbye!");
                    return 0;

                default:
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("Invalid option. Please select 1-8.");
                    Console.ResetColor();
                    Console.WriteLine();
                    break;
            }
        }
    }

    static async Task<int> RunNonInteractiveModeAsync(GameSyncService syncService, string mode, string[] args, IServiceProvider serviceProvider)
    {
        Console.WriteLine($"Running in NON-INTERACTIVE mode: {mode}");
        Console.WriteLine();

        try
        {
            switch (mode.ToLowerInvariant())
            {
                case "full":
                case "all":
                    // Check for --start-page argument
                    var startPageArg = GetCommandLineArgument(args, "--start-page") ??
                                      GetCommandLineArgument(args, "-p");
                    var startPage = 1;
                    if (!string.IsNullOrEmpty(startPageArg) && int.TryParse(startPageArg, out var parsedPage))
                    {
                        startPage = parsedPage;
                    }
                    
                    var platformSettings = serviceProvider.GetRequiredService<PlatformsSettings>();
                    await PerformFullSyncAsync(syncService, interactiveMode: false, platformSettings, startPage);
                    return 0;

                case "games":
                case "games-only":
                    // Check for --start-page argument
                    var gamesStartPageArg = GetCommandLineArgument(args, "--start-page") ??
                                           GetCommandLineArgument(args, "-p");
                    var gamesStartPage = 1;
                    if (!string.IsNullOrEmpty(gamesStartPageArg) && int.TryParse(gamesStartPageArg, out var gamesParsedPage))
                    {
                        gamesStartPage = gamesParsedPage;
                    }
                    
                    var gamesPlatformSettings = serviceProvider.GetRequiredService<PlatformsSettings>();
                    await PerformFullSyncAsync(syncService, interactiveMode: false, gamesPlatformSettings, gamesStartPage, gamesOnly: true);
                    return 0;

                case "update":
                case "incremental":
                    await PerformIncrementalSyncAsync(syncService);
                    return 0;

                case "stats":
                case "statistics":
                    await ShowStatisticsAsync(syncService);
                    return 0;

                case "genres":
                    await SyncGenresOnlyAsync(syncService);
                    return 0;

                case "developers":
                    await SyncDevelopersOnlyAsync(syncService);
                    return 0;

                case "publishers":
                    await SyncPublishersOnlyAsync(syncService);
                    return 0;

                default:
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"Unknown mode: {mode}");
                    Console.ResetColor();
                    Console.WriteLine();
                    Console.WriteLine("Valid modes:");
                    Console.WriteLine("  --mode=full        (or --mode=all) - Full sync of all games and lookup data");
                    Console.WriteLine("  --mode=games       (or --mode=games-only) - Sync games only (skip lookup data)");
                    Console.WriteLine("  --mode=update      (or --mode=incremental) - Incremental sync");
                    Console.WriteLine("  --mode=genres      - Sync only genres lookup data");
                    Console.WriteLine("  --mode=developers  - Sync only developers lookup data");
                    Console.WriteLine("  --mode=publishers  - Sync only publishers lookup data");
                    Console.WriteLine("  --mode=stats       (or --mode=statistics) - Show statistics");
                    Console.WriteLine();
                    return 1;
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Error during sync: {ex.Message}");
            Console.ResetColor();
            return 1;
        }
    }

    static async Task PerformFullSyncAsync(GameSyncService syncService, bool interactiveMode = false, PlatformsSettings? platformSettings = null, int forcedStartPage = 0, bool gamesOnly = false)
    {
        if (gamesOnly)
        {
            Console.WriteLine("Starting GAMES ONLY SYNC...");
            Console.WriteLine("This will sync all games for Nintendo Switch and Switch 2 (without lookup data).");
        }
        else
        {
            Console.WriteLine("Starting FULL SYNC...");
            Console.WriteLine("This will sync all games for Nintendo Switch and Switch 2.");
        }
        
        if (interactiveMode)
        {
            Console.WriteLine("You will be prompted after each page to continue, quit, or auto-complete.");
        }
        Console.WriteLine("This may take a while depending on the number of games.");
        Console.WriteLine();

        // Ask about lookup data sync in interactive mode for full sync
        var shouldSyncLookupData = !gamesOnly;
        if (interactiveMode && !gamesOnly)
        {
            Console.WriteLine("Do you want to sync lookup data (Genres, Developers, Publishers)?");
            Console.WriteLine("Note: This is required if you haven't synced them before or want to update them.");
            Console.Write("Sync lookup data? (Y/N, default Y): ");
            var lookupChoice = Console.ReadLine()?.Trim().ToUpperInvariant();
            Console.WriteLine();

            if (lookupChoice == "N" || lookupChoice == "NO")
            {
                shouldSyncLookupData = false;
                Console.WriteLine("Skipping lookup data sync.");
                Console.WriteLine();
            }
        }

        // Determine start page
        var startPage = 1;
        
        if (forcedStartPage > 0)
        {
            // Command line argument takes priority
            startPage = forcedStartPage;
            Console.WriteLine($"Starting from page {startPage} (specified via command line)");
            Console.WriteLine();
        }
        else if (interactiveMode && platformSettings != null)
        {
            // Always ask user what page to start from in interactive mode
            var switchLastPage = await syncService.GetLastSuccessfulPageAsync(platformSettings.NintendoSwitch);
            var switch2LastPage = await syncService.GetLastSuccessfulPageAsync(platformSettings.NintendoSwitch2);
            
            // Show saved page info if available
            if (switchLastPage.HasValue || switch2LastPage.HasValue)
            {
                Console.WriteLine("Previous sync progress detected:");
                if (switchLastPage.HasValue)
                {
                    Console.WriteLine($"  Nintendo Switch: Last successful page was {switchLastPage.Value}");
                }
                if (switch2LastPage.HasValue)
                {
                    Console.WriteLine($"  Nintendo Switch 2: Last successful page was {switch2LastPage.Value}");
                }
                Console.WriteLine();
            }
            
            Console.WriteLine("What page would you like to start from?");
            if (switchLastPage.HasValue || switch2LastPage.HasValue)
            {
                Console.WriteLine("  [R] Resume from last successful page");
            }
            Console.WriteLine("  [P] Specify a page number to start from");
            Console.WriteLine("  [S] Start from the beginning (page 1)");
            Console.WriteLine();
            Console.Write(switchLastPage.HasValue || switch2LastPage.HasValue ? "Your choice (R/P/S): " : "Your choice (P/S): ");
            
            var choice = Console.ReadLine()?.Trim().ToUpperInvariant();
            Console.WriteLine();

            switch (choice)
            {
                case "R" when (switchLastPage.HasValue || switch2LastPage.HasValue):
                    // Use the maximum of the two last pages
                    startPage = Math.Max(switchLastPage ?? 1, switch2LastPage ?? 1);
                    Console.WriteLine($"Resuming from page {startPage}");
                    break;

                case "P":
                    Console.Write("Enter page number to start from: ");
                    var pageInput = Console.ReadLine()?.Trim();
                    if (int.TryParse(pageInput, out var specifiedPage) && specifiedPage > 0)
                    {
                        startPage = specifiedPage;
                        Console.WriteLine($"Starting from page {startPage}");
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("Invalid page number. Starting from page 1.");
                        Console.ResetColor();
                        startPage = 1;
                    }
                    break;

                case "S":
                case "":
                    startPage = 1;
                    Console.WriteLine("Starting from the beginning (page 1)");
                    break;

                default:
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("Invalid choice. Starting from the beginning (page 1).");
                    Console.ResetColor();
                    startPage = 1;
                    break;
            }
            Console.WriteLine();
        }

        var startTime = DateTime.UtcNow;
        
        try
        {
            await syncService.SyncAllGamesAsync(interactiveMode, startPage, shouldSyncLookupData);
            
            var duration = DateTime.UtcNow - startTime;
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"✓ Full sync completed successfully in {duration.TotalMinutes:F2} minutes!");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"✗ Full sync failed: {ex.Message}");
            Console.ResetColor();
        }

        Console.WriteLine();
        await ShowStatisticsAsync(syncService);
        Console.WriteLine();
    }

    static async Task PerformIncrementalSyncAsync(GameSyncService syncService)
    {
        Console.WriteLine("Starting INCREMENTAL SYNC...");
        Console.WriteLine("This will sync lookup data and games updated since the last sync.");
        Console.WriteLine();

        var startTime = DateTime.UtcNow;

        try
        {
            await syncService.SyncUpdatesAsync();

            var duration = DateTime.UtcNow - startTime;
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"✓ Incremental sync completed successfully in {duration.TotalMinutes:F2} minutes!");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"✗ Incremental sync failed: {ex.Message}");
            Console.ResetColor();
        }

        Console.WriteLine();
        await ShowStatisticsAsync(syncService);
        Console.WriteLine();
    }

    static async Task ShowStatisticsAsync(GameSyncService syncService)
    {
        Console.WriteLine("===========================================");
        Console.WriteLine("Cache Statistics:");
        Console.WriteLine("===========================================");

        try
        {
            var stats = await syncService.GetStatisticsAsync();

            // Storage mode
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine($"Storage Mode: {stats.StorageMode}");
            Console.ResetColor();
            Console.WriteLine();

            // Game statistics
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"Total Games Cached: {stats.TotalGamesCached:N0}");
            Console.ResetColor();
            Console.WriteLine($"Last Sync Time: {(stats.LastSyncTime.HasValue ? stats.LastSyncTime.Value.ToString("yyyy-MM-dd HH:mm:ss UTC") : "Never")}");
            Console.WriteLine();

            // Dual mode: Show comparison
            if (stats.StorageMode == StorageMode.Dual && stats.BlobGameCount.HasValue && stats.SqlGameCount.HasValue)
            {
                Console.WriteLine("Storage Comparison (Blob / SQL):");
                
                // Games comparison
                var gamesMatch = stats.BlobGameCount == stats.SqlGameCount;
                Console.ForegroundColor = gamesMatch ? ConsoleColor.Green : ConsoleColor.Yellow;
                Console.WriteLine($"  Games: {stats.BlobGameCount:N0} / {stats.SqlGameCount:N0} {(gamesMatch ? "✓" : "⚠")}");
                Console.ResetColor();
                
                // Genres comparison
                var genresMatch = stats.BlobGenreCount == stats.SqlGenreCount;
                Console.ForegroundColor = genresMatch ? ConsoleColor.Green : ConsoleColor.Yellow;
                Console.WriteLine($"  Genres: {stats.BlobGenreCount:N0} / {stats.SqlGenreCount:N0} {(genresMatch ? "✓" : "⚠")}");
                Console.ResetColor();
                
                // Developers comparison
                var devsMatch = stats.BlobDeveloperCount == stats.SqlDeveloperCount;
                Console.ForegroundColor = devsMatch ? ConsoleColor.Green : ConsoleColor.Yellow;
                Console.WriteLine($"  Developers: {stats.BlobDeveloperCount:N0} / {stats.SqlDeveloperCount:N0} {(devsMatch ? "✓" : "⚠")}");
                Console.ResetColor();
                
                // Publishers comparison
                var pubsMatch = stats.BlobPublisherCount == stats.SqlPublisherCount;
                Console.ForegroundColor = pubsMatch ? ConsoleColor.Green : ConsoleColor.Yellow;
                Console.WriteLine($"  Publishers: {stats.BlobPublisherCount:N0} / {stats.SqlPublisherCount:N0} {(pubsMatch ? "✓" : "⚠")}");
                Console.ResetColor();
                
                Console.WriteLine();
            }

            // Lookup data with counts (primary storage)
            Console.WriteLine("Lookup Data:");
            Console.ForegroundColor = stats.HasGenres ? ConsoleColor.Green : ConsoleColor.Red;
            Console.WriteLine($"  Genres: {(stats.HasGenres ? $"✓ {stats.GenreCount:N0} cached" : "✗ Not cached")}");
            Console.ResetColor();
            
            Console.ForegroundColor = stats.HasDevelopers ? ConsoleColor.Green : ConsoleColor.Red;
            Console.WriteLine($"  Developers: {(stats.HasDevelopers ? $"✓ {stats.DeveloperCount:N0} cached" : "✗ Not cached")}");
            Console.ResetColor();
            
            Console.ForegroundColor = stats.HasPublishers ? ConsoleColor.Green : ConsoleColor.Red;
            Console.WriteLine($"  Publishers: {(stats.HasPublishers ? $"✓ {stats.PublisherCount:N0} cached" : "✗ Not cached")}");
            Console.ResetColor();

            // Storage-specific info
            Console.WriteLine();
            switch (stats.StorageMode)
            {
                case StorageMode.Blob:
                    Console.WriteLine("Storage Location: Azure Blob Storage");
                    Console.WriteLine("  - Container: games-cache");
                    break;
                case StorageMode.SqlDatabase:
                    Console.WriteLine("Storage Location: Azure SQL Database");
                    Console.WriteLine("  - Database: switchlibrary-games");
                    Console.WriteLine("  - Metadata stored in: Blob Storage");
                    break;
                case StorageMode.Dual:
                    Console.WriteLine("Storage Location: Dual (Blob + SQL Database)");
                    Console.WriteLine("  - Primary: Azure SQL Database (switchlibrary-games)");
                    Console.WriteLine("  - Secondary: Azure Blob Storage (games-cache)");
                    Console.WriteLine("  - Metadata stored in: Blob Storage");
                    Console.WriteLine();
                    if (stats.BlobGameCount == stats.SqlGameCount && 
                        stats.BlobGenreCount == stats.SqlGenreCount &&
                        stats.BlobDeveloperCount == stats.SqlDeveloperCount &&
                        stats.BlobPublisherCount == stats.SqlPublisherCount)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("  ✓ Blob and SQL are in sync");
                        Console.ResetColor();
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("  ⚠ Blob and SQL counts differ - consider re-syncing");
                        Console.ResetColor();
                    }
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Error getting statistics: {ex.Message}");
            Console.ResetColor();
        }

        Console.WriteLine("===========================================");
    }

    static async Task SyncGenresOnlyAsync(GameSyncService syncService)
    {
        Console.WriteLine("===========================================");
        Console.WriteLine("Syncing Genres Lookup Data:");
        Console.WriteLine("===========================================");

        try
        {
            await syncService.SyncGenresAsync();
            
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("✓ Genres sync completed successfully!");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"✗ Error syncing genres: {ex.Message}");
            Console.ResetColor();
        }

        Console.WriteLine("===========================================");
        Console.WriteLine();
    }

    static async Task SyncDevelopersOnlyAsync(GameSyncService syncService)
    {
        Console.WriteLine("===========================================");
        Console.WriteLine("Syncing Developers Lookup Data:");
        Console.WriteLine("===========================================");

        try
        {
            await syncService.SyncDevelopersAsync();
            
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("✓ Developers sync completed successfully!");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"✗ Error syncing developers: {ex.Message}");
            Console.ResetColor();
        }

        Console.WriteLine("===========================================");
        Console.WriteLine();
    }

    static async Task SyncPublishersOnlyAsync(GameSyncService syncService)
    {
        Console.WriteLine("===========================================");
        Console.WriteLine("Syncing Publishers Lookup Data:");
        Console.WriteLine("===========================================");

        try
        {
            await syncService.SyncPublishersAsync();
            
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("✓ Publishers sync completed successfully!");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"✗ Error syncing publishers: {ex.Message}");
            Console.ResetColor();
        }

        Console.WriteLine("===========================================");
        Console.WriteLine();
    }

    static string? GetCommandLineArgument(string[] args, string name)
    {
        foreach (var arg in args)
        {
            if (arg.StartsWith($"{name}=", StringComparison.OrdinalIgnoreCase))
            {
                return arg.Substring(name.Length + 1);
            }
            else if (arg.Equals(name, StringComparison.OrdinalIgnoreCase))
            {
                var index = Array.IndexOf(args, arg);
                if (index >= 0 && index < args.Length - 1)
                {
                    return args[index + 1];
                }
            }
        }
        return null;
    }
}
