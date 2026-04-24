import { assert } from '@gamezilla/lib/assert/singleton';

/** RFC 4122 UUID v4 pattern (lowercase hex with hyphens). */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Asserts value is a valid UUID string at trust boundaries. Crashes on violation.
 */
export function assertUuid(value: unknown, message: string): asserts value is string {
  assert.string(value, message);
  assert.ok(UUID_REGEX.test(value), message, { value });
}

/**
 * Asserts principalId is a valid UUID. Crashes on violation.
 */
export function assertPrincipalId(value: unknown): asserts value is string {
  assertUuid(value, 'principalId must be a valid UUID');
}
