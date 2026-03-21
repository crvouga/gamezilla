import { assert } from './assert';

/**
 * Asserts that the provided value is a string.
 * Throws if the value is not a string.
 *
 * @param value   - The value to check.
 * @param message - Human-readable description of the invariant.
 * @throws {{ __assertion_failure: true, message: string, context?: unknown }}
 */
export function assertString(
  value: unknown,
  message: string
): asserts value is string {
  assert(typeof value === 'string', message, { value });
}
