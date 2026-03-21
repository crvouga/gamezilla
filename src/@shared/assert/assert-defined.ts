import { assert } from './assert';

/**
 * Asserts that the provided value is neither null nor undefined.
 * Throws an error if the value is not defined.
 *
 * @template T The expected type of the value.
 * @param {T | null | undefined} value - The value to check.
 * @returns {T} The value, guaranteed to be defined.
 * @throws Will throw an error if the value is null or undefined.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  assert(value !== null && value !== undefined, message);
}
