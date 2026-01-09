/**
 * ILogger.ts - Port interface for logging
 *
 * This interface defines the logging capabilities needed by the use case.
 */

/**
 * Port interface for logging.
 * Defines the logging capabilities the use case needs.
 */
export interface ILogger {
  /**
   * Logs an informational message.
   */
  info(message: string): void;

  /**
   * Logs an error message.
   */
  error(message: string): void;

  /**
   * Logs a warning message.
   */
  warning(message: string): void;
}
