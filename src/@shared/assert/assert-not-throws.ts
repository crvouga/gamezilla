import { assert } from './assert';

/**
 * Asserts that the provided function does not throw an error when invoked.
 * If the function throws, this will log details and trigger a crash
 * via the `assert` mechanism.
 *
 * Intended for Tiger Style invariants: use when a function is required not to throw
 * under correct circumstances, and you want to fail fast if it happens.
 *
 * @param fn - The function to invoke, which should not throw.
 * @throws If the function throws, the process will crash or poison the page.
 */
export function assertNotThrows(
  fn: () => unknown,
  message: string,
  context?: Record<string, unknown>
): asserts fn is () => unknown {
  try {
    fn();
  } catch (error) {
    assert(false, message, { ...context, error });
  }
}
