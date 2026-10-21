/**
 * Durable "you were signed out on this device" marker. Recorded when the
 * device learns its sign-in ended without the person asking for it there, so
 * the notice survives the switch to a guest and an app restart; cleared when
 * the person dismisses it or signs in again.
 */

import type { SecureStorageStore } from '@pkgs/secure-storage-root-shared/secure-storage-store';
import { writeSecureStorageItem } from '@pkgs/secure-storage-root-shared/secure-storage-store';
import { SIGNED_OUT_NOTICE_KEY } from './auth-storage-keys';

export type SignedOutNotice = {
  /** Changes made on the device that had not been shared, and were not kept. */
  readonly unshared: number;
};

export function parseSignedOutNotice(
  raw: string | null
): SignedOutNotice | null {
  if (raw === null || raw.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;
    const unshared = (parsed as Record<string, unknown>)['unshared'];
    if (typeof unshared !== 'number' || !Number.isInteger(unshared)) {
      return null;
    }
    return { unshared: Math.max(0, unshared) };
  } catch {
    return null;
  }
}

export function recordSignedOutNotice(
  store: SecureStorageStore,
  notice: SignedOutNotice
): Promise<void> {
  return writeSecureStorageItem(
    store,
    SIGNED_OUT_NOTICE_KEY,
    JSON.stringify({ unshared: notice.unshared })
  );
}

export function clearSignedOutNotice(store: SecureStorageStore): Promise<void> {
  return writeSecureStorageItem(store, SIGNED_OUT_NOTICE_KEY, null);
}
