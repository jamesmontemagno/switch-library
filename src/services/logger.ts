/**
 * Universal Logger Service
 * 
 * Only enables logging for a specific user ID set via VITE_DEBUG_USER_ID environment variable.
 * This allows debugging production issues for specific users without exposing logs for everyone.
 * 
 * Usage:
 *   import { logger } from './services/logger';
 *   
 *   logger.info('Loading games', { count: games.length });
 *   logger.error('Failed to fetch', error);
 *   logger.debug('Cache hit', { gameId: 123 });
 * 
 * Configuration:
 *   Set VITE_DEBUG_USER_ID in .env or GitHub Actions environment variables
 *   to enable logging for that user
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private debugUserId: string | undefined;
  private currentUserId: string | null = null;
  private isEnabled = false;

  constructor() {
    this.debugUserId = import.meta.env.VITE_DEBUG_USER_ID;
  }

  /**
   * Set the current user ID to check against debug user ID
   * This should be called when user auth state changes
   */
  setUser(userId: string | null): void {
    this.currentUserId = userId;
    this.isEnabled = !!(this.debugUserId && userId && userId === this.debugUserId);
    
    if (this.isEnabled) {
      console.log(
        '%c[Logger] Debug logging enabled for user',
        'color: #4CAF50; font-weight: bold',
        userId
      );
    }
  }

  /**
   * Get current logging state
   */
  getState(): { enabled: boolean; userId: string | null; debugUserId: string | undefined } {
    return {
      enabled: this.isEnabled,
      userId: this.currentUserId,
      debugUserId: this.debugUserId,
    };
  }

  /**
   * Debug level - detailed information for debugging
   */
  debug(message: string, context?: LogContext): void {
    if (this.isEnabled) {
      this.log('debug', message, context);
    }
  }

  /**
   * Info level - informational messages about app state
   */
  info(message: string, context?: LogContext): void {
    if (this.isEnabled) {
      this.log('info', message, context);
    }
  }

  /**
   * Warn level - warning messages for non-critical issues
   */
  warn(message: string, context?: LogContext): void {
    if (this.isEnabled) {
      this.log('warn', message, context);
    }
  }

  /**
   * Error level - error messages for critical issues
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.isEnabled) {
      const errorContext = {
        ...context,
        error: error instanceof Error 
          ? { message: error.message, stack: error.stack, name: error.name }
          : error,
      };
      this.log('error', message, errorContext);
    }
  }

  /**
   * Log API usage for tracking rate limits
   */
  apiUsage(endpoint: string, context?: LogContext): void {
    if (this.isEnabled) {
      this.log('info', `[API] ${endpoint}`, { ...context, type: 'api-usage' });
    }
  }

  /**
   * Log cache operations
   */
  cache(operation: 'hit' | 'miss' | 'set' | 'clear', key: string, context?: LogContext): void {
    if (this.isEnabled) {
      this.log('debug', `[Cache] ${operation}: ${key}`, { ...context, type: 'cache' });
    }
  }

  /**
   * Log database operations
   */
  database(operation: string, table: string, context?: LogContext): void {
    if (this.isEnabled) {
      this.log('debug', `[DB] ${operation} on ${table}`, { ...context, type: 'database' });
    }
  }

  /**
   * Log authentication events
   */
  auth(event: string, context?: LogContext): void {
    if (this.isEnabled) {
      this.log('info', `[Auth] ${event}`, { ...context, type: 'auth' });
    }
  }

  /**
   * Log navigation events
   */
  navigation(path: string, context?: LogContext): void {
    if (this.isEnabled) {
      this.log('debug', `[Nav] ${path}`, { ...context, type: 'navigation' });
    }
  }

  /**
   * Log component lifecycle events
   */
  component(name: string, event: 'mount' | 'unmount' | 'update', context?: LogContext): void {
    if (this.isEnabled) {
      this.log('debug', `[Component] ${name} ${event}`, { ...context, type: 'component' });
    }
  }

  /**
   * Internal log method with consistent formatting
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const styles = this.getStyles(level);
    
    const logData = {
      timestamp,
      level,
      message,
      userId: this.currentUserId,
      ...context,
    };

    switch (level) {
      case 'debug':
        console.debug(`%c[${timestamp}] ${message}`, styles, context || '');
        break;
      case 'info':
        console.info(`%c[${timestamp}] ${message}`, styles, context || '');
        break;
      case 'warn':
        console.warn(`%c[${timestamp}] ${message}`, styles, context || '');
        break;
      case 'error':
        console.error(`%c[${timestamp}] ${message}`, styles, context || '');
        break;
    }

    // Log full context as a separate object for easier inspection
    if (context && Object.keys(context).length > 0) {
      console.log(logData);
    }
  }

  /**
   * Get console styling based on log level
   */
  private getStyles(level: LogLevel): string {
    const baseStyle = 'font-weight: bold;';
    switch (level) {
      case 'debug':
        return `${baseStyle} color: #9E9E9E;`;
      case 'info':
        return `${baseStyle} color: #2196F3;`;
      case 'warn':
        return `${baseStyle} color: #FF9800;`;
      case 'error':
        return `${baseStyle} color: #F44336;`;
      default:
        return baseStyle;
    }
  }
}

// Export singleton instance
export const logger = new Logger();
