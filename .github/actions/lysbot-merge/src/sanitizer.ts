/**
 * sanitizer.ts - Utility functions for sanitizing Git commit message content
 *
 * These functions prevent newline injection attacks in Git commit messages
 * by replacing newline characters in user-controlled inputs with spaces.
 */

/**
 * Sanitizes a string by replacing all newline characters (LF, CR, and CRLF) with spaces.
 * This prevents newline injection attacks in Git commit messages.
 *
 * @param input - The string to sanitize
 * @returns The sanitized string with all newlines replaced by spaces and trimmed
 *
 * @example
 * ```typescript
 * sanitizeNewlines('Hello\nWorld') // Returns: 'Hello World'
 * sanitizeNewlines('Title\r\nWith CRLF') // Returns: 'Title With CRLF'
 * sanitizeNewlines('Normal text') // Returns: 'Normal text'
 * ```
 */
export function sanitizeNewlines(input: string): string {
  // Replace all newline characters (LF, CR, CRLF) with spaces
  // This prevents injection of Git trailers or other malicious content
  return input.replace(/[\r\n]+/g, ' ').trim();
}
