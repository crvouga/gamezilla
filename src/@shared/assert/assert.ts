import { crash } from './crash/crash';
import { ValidationError } from './validation-error';

/**
 * Assertion helper with two modes: {@link Assert.validation} throws {@link ValidationError};
 * {@link Assert.crash} logs and terminates the process or shows a fatal UI (see `crash`).
 */
export class Assert {
  /**
   * Returns an assert instance that throws {@link ValidationError} on failure (for recoverable input checks).
   */
  static validation(): Assert {
    return new Assert('validation');
  }

  /**
   * Returns an assert instance that uses the global crash path on failure (non-recoverable invariant violations).
   */
  static crash(): Assert {
    return new Assert('crash');
  }

  private constructor(
    private readonly errorMode: 'validation' | 'crash' = 'crash'
  ) {}

  /**
   * Asserts that `condition` is true.
   *
   * @param condition - Predicate that must hold.
   * @param message - Message when the assertion fails.
   * @param context - Optional structured context attached to the failure.
   */
  ok(
    condition: boolean,
    message: string,
    context?: Record<string, unknown>
  ): asserts condition {
    switch (this.errorMode) {
      case 'validation': {
        if (!condition) {
          throw new ValidationError(message, context);
        }
        return;
      }
      default: {
        crash(condition, message, context);
      }
    }
  }

  /**
   * Indicates unreachable code. Always fails the assertion.
   *
   * @param message - Message to describe why this code path is unreachable.
   * @param context - Optional structured context attached to the failure.
   * @throws ValidationError if in validation mode.
   * @throws Error (crashes) if in crash mode.
   */
  unreachable(
    message: string,
    context?: Record<string, unknown>
  ): asserts message is never {
    this.ok(false, message, context);
  }

  /**
   * Asserts that `value` is one of the strings in `values`.
   *
   * @param value - Value to check.
   * @param values - Allowed string literals.
   * @param message - Message when the assertion fails.
   */
  enum<T extends string>(
    value: unknown,
    values: T[],
    message: string
  ): asserts value is T {
    this.ok(values.includes(value as T), message, { value, values });
  }

  /**
   * Asserts that `value` is an array (`Array.isArray`).
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   * @param context - Optional extra context (merged with `value`).
   */
  array(
    value: unknown,
    message: string,
    context?: Record<string, unknown>
  ): asserts value is unknown[] {
    this.ok(Array.isArray(value), message, { ...context, value });
  }

  /**
   * Asserts that `value` is neither `null` nor `undefined`.
   *
   * @param value - Possibly nullish value.
   * @param message - Message when the assertion fails.
   * @param context - Optional extra context (merged with `value`).
   */
  defined<T>(
    value: T | null | undefined,
    message: string,
    context?: Record<string, unknown>
  ): asserts value is T {
    this.ok(value !== undefined && value !== null, message, {
      ...context,
      value,
    });
  }

  /**
   * Asserts strict equality (`===`) between `actual` and `expected`.
   *
   * @param actual - Observed value.
   * @param expected - Expected value.
   * @param message - Message when the assertion fails.
   * @param context - Optional extra context (merged with `actual` and `expected`).
   */
  equals(
    actual: unknown,
    expected: unknown,
    message: string,
    context?: Record<string, unknown>
  ): asserts actual is unknown {
    this.ok(actual === expected, message, { ...context, actual, expected });
  }

  /**
   * Asserts that `value` has an own or inherited property `field` (`field in value`).
   *
   * @param value - Object to inspect.
   * @param field - Property key that must be present.
   * @param message - Message when the assertion fails.
   */
  field<O extends object, K extends PropertyKey>(
    value: O,
    field: K,
    message: string
  ): asserts value is O & Record<K, unknown> {
    this.ok(field in value, message, { value, field });
  }

  /**
   * Asserts that `value` is an instance of `ctor`.
   *
   * @param value - Value to check.
   * @param ctor - Constructor function.
   * @param message - Message when the assertion fails.
   */
  instanceOf<T>(
    value: unknown,
    ctor: new (...args: unknown[]) => T,
    message: string
  ): asserts value is T {
    this.ok(value instanceof ctor, message, { value, ctor: ctor.name });
  }

  /**
   * Unreachable-arm assertion: narrows `never` after exhaustive checks.
   *
   * @param value - Value that should be impossible at this point.
   * @param message - Message when the assertion fails.
   * @param context - Optional extra context (merged with `value`).
   */
  never(
    value: never,
    message: string,
    context?: Record<string, unknown>
  ): asserts value is never {
    this.ok(false, message, { ...context, value });
  }

  /**
   * Asserts that `value` is a non-null object and not an array.
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  record(
    value: unknown,
    message: string
  ): asserts value is Record<string, unknown> {
    this.ok(
      value !== null && typeof value === 'object' && !Array.isArray(value),
      message,
      { value }
    );
  }

  /**
   * Asserts that `value` has runtime type `string`.
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  string(value: unknown, message: string): asserts value is string {
    this.ok(typeof value === 'string', message, { value });
  }

  /**
   * Asserts that `value` is a finite number (not NaN, not ±Infinity).
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  number(value: unknown, message: string): asserts value is number {
    this.ok(typeof value === 'number', message, {
      value,
      type: typeof value,
    });
    this.ok(Number.isFinite(value), message, {
      value,
      isFinite: Number.isFinite(value),
    });
    this.ok(!Number.isNaN(value), message, {
      value,
      isNaN: Number.isNaN(value),
    });
  }

  /**
   * Asserts that `value` is a safe integer within `Number.MIN_SAFE_INTEGER`…`Number.MAX_SAFE_INTEGER`.
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  integer(value: unknown, message: string): asserts value is number {
    this.number(value, message);
    this.ok(
      value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER,
      message,
      {
        value,
        min: Number.MIN_SAFE_INTEGER,
        max: Number.MAX_SAFE_INTEGER,
      }
    );
    this.ok(Number.isSafeInteger(value), message, {
      value,
      isSafeInteger: Number.isSafeInteger(value),
    });
  }

  /**
   * Asserts that `fn` completes without throwing.
   *
   * @param fn - Function to invoke.
   * @param message - Message when `fn` throws.
   * @param context - Optional extra context (the caught `error` is merged in on failure).
   */
  notThrows(
    fn: () => unknown,
    message: string,
    context?: Record<string, unknown>
  ): asserts fn is () => unknown {
    try {
      fn();
      return;
    } catch (error) {
      this.ok(false, message, { ...context, error });
    }
  }

  /**
   * Asserts that `values` is an array and runs `fn` as a per-element assertion (narrows the element type).
   *
   * @param values - Array to check and iterate.
   * @param fn - Assertion callback invoked for each element.
   */
  all<T extends U, U = unknown>(
    values: U[] | U,
    fn: (value: U) => asserts value is T extends U ? T : never
  ): asserts values is T[] {
    this.array(values, 'values must be an array');
    for (const value of values) {
      fn(value);
    }
  }
}
