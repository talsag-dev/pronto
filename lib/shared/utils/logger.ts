/**
 * Logging utilities
 *
 * This module provides a centralized logging interface.
 * Currently wraps console.log but can be extended to use
 * external logging services (e.g., Sentry, DataDog, CloudWatch).
 */

import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Base logger class
 */
class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = env.NODE_ENV === 'development';
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context)}`;
    }

    return `${prefix} ${message}`;
  }

  /**
   * Debug level logging (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage('info', message, context));
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error instanceof Error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    console.error(this.formatMessage('error', message, errorContext));
  }

  /**
   * Log with specific level
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    switch (level) {
      case 'debug':
        this.debug(message, context);
        break;
      case 'info':
        this.info(message, context);
        break;
      case 'warn':
        this.warn(message, context);
        break;
      case 'error':
        this.error(message, undefined, context);
        break;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Helper function to log API requests
 */
export function logApiRequest(
  method: string,
  url: string,
  statusCode: number,
  duration?: number
): void {
  const context: LogContext = {
    method,
    url,
    statusCode,
    ...(duration && { duration: `${duration}ms` }),
  };

  if (statusCode >= 500) {
    logger.error('API request failed', undefined, context);
  } else if (statusCode >= 400) {
    logger.warn('API request error', context);
  } else {
    logger.info('API request', context);
  }
}

/**
 * Helper function to log database operations
 */
export function logDatabaseOperation(
  operation: string,
  table: string,
  duration?: number,
  error?: Error
): void {
  const context: LogContext = {
    operation,
    table,
    ...(duration && { duration: `${duration}ms` }),
  };

  if (error) {
    logger.error('Database operation failed', error, context);
  } else {
    logger.debug('Database operation', context);
  }
}

/**
 * Helper function to log external service calls
 */
export function logExternalService(
  service: string,
  operation: string,
  success: boolean,
  duration?: number,
  error?: Error
): void {
  const context: LogContext = {
    service,
    operation,
    success,
    ...(duration && { duration: `${duration}ms` }),
  };

  if (error) {
    logger.error('External service call failed', error, context);
  } else {
    logger.info('External service call', context);
  }
}
