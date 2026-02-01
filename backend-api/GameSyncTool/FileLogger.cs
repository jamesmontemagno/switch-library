using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;

namespace GameSyncTool;

public class FileLoggerProvider : ILoggerProvider
{
    private readonly string _path;
    private readonly ConcurrentDictionary<string, FileLogger> _loggers = new();
    private readonly object _lock = new();

    public FileLoggerProvider(string path)
    {
        _path = path;
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }
    }

    public ILogger CreateLogger(string categoryName)
    {
        return _loggers.GetOrAdd(categoryName, name => new FileLogger(name, _path, _lock));
    }

    public void Dispose()
    {
        _loggers.Clear();
    }
}

public class FileLogger : ILogger
{
    private readonly string _categoryName;
    private readonly string _path;
    private readonly object _lock;

    public FileLogger(string categoryName, string path, object lockObj)
    {
        _categoryName = categoryName;
        _path = path;
        _lock = lockObj;
    }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel))
        {
            return;
        }

        var logMessage = $"{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} [{logLevel}] {_categoryName}: {formatter(state, exception)}";
        
        if (exception != null)
        {
            logMessage += Environment.NewLine + exception.ToString();
        }

        lock (_lock)
        {
            try
            {
                File.AppendAllText(_path, logMessage + Environment.NewLine);
            }
            catch
            {
                // Silently fail if we can't write to the log file
            }
        }
    }
}
