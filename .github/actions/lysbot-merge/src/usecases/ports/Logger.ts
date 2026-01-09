/**
 * Logger port - Interface for logging operations
 *
 * This port is defined in the usecases layer to keep the use case
 * independent of specific logging implementations (like @actions/core).
 */

export interface Logger {
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
