/**
 * shared/kernel/result.ts - Result type for error handling
 *
 * Universal vocabulary base. No logic. Can be accessed from anywhere.
 */

/**
 * Result type for operations that can succeed or fail.
 * This is a universal type that can be used across all modules.
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Creates a successful Result.
 */
export function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Creates a failed Result.
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}
