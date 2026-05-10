import { assertDeviceId } from '../shared';
import { assert } from '@gamezilla/lib/assert';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

/** Must match expo-secure-store key rules (`[\w.-]+`). */
export const DEVICE_STORAGE_KEY = 'gamezilla.deviceId';

export interface DeviceService {
  /** Stable per-install device UUID; never null. Crashes if invariant violated. */
  getDeviceId(): string;
}

/**
 * Loads or creates deviceId in secure storage. If stored value is corrupt, crashes
 * (does not silently regenerate — that would orphan patches).
 */
export async function createDeviceService(
  storage: SecureStorage
): Promise<DeviceService> {
  let raw: string | null = null;
  try {
    raw = await storage.getItem(DEVICE_STORAGE_KEY);
  } catch (err) {
    assert.fail(
      'Failed to read deviceId from secure storage — refusing to generate a new id',
      { error: err instanceof Error ? err.message : String(err) }
    );
  }

  if (raw === null) {
    const id = globalThis.crypto.randomUUID();
    try {
      await storage.setItem(DEVICE_STORAGE_KEY, id);
    } catch (err) {
      assert.fail('Failed to persist new deviceId to secure storage', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    raw = id;
  }

  assertDeviceId(raw);

  const deviceId: string = raw;

  return {
    getDeviceId(): string {
      assertDeviceId(deviceId);
      return deviceId;
    },
  };
}
