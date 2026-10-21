import { assertUuid } from '@pkgs/uuid-shared-ts/uuid';

/**
 * Asserts deviceId is a valid UUID. Crashes on violation.
 */
export function assertDeviceId(value: unknown): asserts value is string {
  assertUuid(value, 'deviceId must be a valid UUID');
}
