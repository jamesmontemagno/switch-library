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

            // Get the sync service
            var syncService = serviceProvider.GetRequiredService<GameSyncService>();

            // Parse command line arguments
            var mode = GetCommandLineArgument(args, "--mode") ?? 
                      GetCommandLineArgument(args, "-m");

            if (string.IsNullOrEmpty(mode))
            {
                // Interactive mode
                return await RunInteractiveModeAsync(syncService);
            }
            else
            {
                // Non-interactive mode
                return await RunNonInteractiveModeAsync(syncService, mode);
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
        // Add logging
        services.AddLogging(builder =>
        {
            builder.AddConfiguration(configuration.GetSection("Logging"));
            builder.AddConsole();
        });

        // Add HttpClient
        services.AddHttpClient<GameSyncService>();

        // Add settings
        services.AddSingleton(appSettings.TheGamesDB);
        services.AddSingleton(appSettings.BlobStorage);
        services.AddSingleton(appSettings.Platforms);

        // Add sync service
        services.AddSingleton<GameSyncService>();
    }

    static async Task<int> RunInteractiveModeAsync(GameSyncService syncService)
    {
        Console.WriteLine("Running in INTERACTIVE mode");
        Console.WriteLine();

        while (true)
        {
            Console.WriteLine("===========================================");
            Console.WriteLine("Main Menu:");
            Console.WriteLine("===========================================");
            Console.WriteLine("1. Full Sync - Sync all games");
            Console.WriteLine("2. Incremental Sync - Sync only updates");
            Console.WriteLine("3. Show Statistics");
            Console.WriteLine("4. Exit");
            Console.WriteLine();
            Console.Write("Select an option (1-4): ");

            var choice = Console.ReadLine()?.Trim();
            Console.WriteLine();

            switch (choice)
            {
                case "1":
                    await PerformFullSyncAsync(syncService);
                    break;

                case "2":
                    await PerformIncrementalSyncAsync(syncService);
                    break;

                case "3":
                    await ShowStatisticsAsync(syncService);
                    break;

                case "4":
                    Console.WriteLine("Goodbye!");
                    return 0;

                default:
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("Invalid option. Please select 1-4.");
                    Console.ResetColor();
                    Console.WriteLine();
                    break;
            }
        }
    }

    static async Task<int> RunNonInteractiveModeAsync(GameSyncService syncService, string mode)
    {
        Console.WriteLine($"Running in NON-INTERACTIVE mode: {mode}");
        Console.WriteLine();

        try
        {
            switch (mode.ToLowerInvariant())
            {
                case "full":
                case "all":
                    await PerformFullSyncAsync(syncService);
                    return 0;

                case "update":
                case "incremental":
                    await PerformIncrementalSyncAsync(syncService);
                    return 0;

                case "stats":
                case "statistics":
                    await ShowStatisticsAsync(syncService);
                    return 0;

                default:
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"Unknown mode: {mode}");
                    Console.ResetColor();
                    Console.WriteLine();
                    Console.WriteLine("Valid modes:");
                    Console.WriteLine("  --mode=full        (or --mode=all) - Full sync of all games");
                    Console.WriteLine("  --mode=update      (or --mode=incremental) - Incremental sync");
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

    static async Task PerformFullSyncAsync(GameSyncService syncService)
    {
        Console.WriteLine("Starting FULL SYNC...");
        Console.WriteLine("This will sync all games for Nintendo Switch and Switch 2.");
        Console.WriteLine("This may take a while depending on the number of games.");
        Console.WriteLine();

        var startTime = DateTime.UtcNow;
        
        try
        {
            await syncService.SyncAllGamesAsync();
            
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
        Console.WriteLine("This will sync only games that have been updated since the last sync.");
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

            Console.WriteLine($"Total Games Cached: {stats.TotalGamesCached}");
            Console.WriteLine($"Last Sync Time: {(stats.LastSyncTime.HasValue ? stats.LastSyncTime.Value.ToString("yyyy-MM-dd HH:mm:ss UTC") : "Never")}");
            Console.WriteLine();
            Console.WriteLine("Lookup Data:");
            Console.WriteLine($"  Genres: {(stats.HasGenres ? "✓ Cached" : "✗ Not cached")}");
            Console.WriteLine($"  Developers: {(stats.HasDevelopers ? "✓ Cached" : "✗ Not cached")}");
            Console.WriteLine($"  Publishers: {(stats.HasPublishers ? "✓ Cached" : "✗ Not cached")}");
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Error getting statistics: {ex.Message}");
            Console.ResetColor();
        }

        Console.WriteLine("===========================================");
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
