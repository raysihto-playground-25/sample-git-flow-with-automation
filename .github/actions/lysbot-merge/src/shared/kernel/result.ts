/**
 * result.ts - Result type for explicit error handling
 *
 * This module provides a Result type that represents either success or failure,
 * enabling explicit error handling without exceptions.
 */

/**
 * Represents a successful result containing a value.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Represents a failed result containing an error.
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type that can be either Ok (success) or Err (failure).
 * Use this instead of throwing exceptions for business logic failures.
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Creates a successful Result.
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Creates a failed Result.
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard to check if a Result is Ok.
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard to check if a Result is Err.
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}
