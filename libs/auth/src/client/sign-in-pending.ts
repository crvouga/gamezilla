/**
 * Durable "sign-in in flight" marker. The OAuth redirect unloads the web page
 * (and may background the native app), so in-memory modal state is lost mid
 * flow. We persist an ISO start timestamp in secure storage when sign-in begins
 * and read it back on the next mount to resume the modal's loading state.
 *
 * Entries older than {@link SIGN_IN_PENDING_TTL_MS} are treated as stale (the
 * user abandoned the flow long ago) so a forgotten marker never spuriously
 * re-opens the modal on a cold start.
 */

import type { SecureStorage } from '@pkgs/secure-storage/interface';
import {
  useSecureStorageItem,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';

import { SIGN_IN_PENDING_KEY } from './auth-storage-keys';

/** A sign-in marker older than this is considered abandoned. */
export const SIGN_IN_PENDING_TTL_MS = 30 * 60 * 1000;

export async function markSignInPending(storage: SecureStorage): Promise<void> {
  await writeSecureStorageItem(
    storage,
    SIGN_IN_PENDING_KEY,
    new Date().toISOString()
  );
}

export async function clearSignInPending(
  storage: SecureStorage
): Promise<void> {
  await writeSecureStorageItem(storage, SIGN_IN_PENDING_KEY, null);
}

/**
 * Returns the start time of a non-stale pending sign-in, or `null` when there
 * is no marker or it has expired.
 */
export function parseSignInPending(value: string | null): Date | null {
  if (value === null || value.length === 0) return null;
  const startedAt = new Date(value);
  const ms = startedAt.getTime();
  if (Number.isNaN(ms)) return null;
  if (Date.now() - ms > SIGN_IN_PENDING_TTL_MS) return null;
  return startedAt;
}

/**
 * Reactive view of the pending marker for the modal provider. `pending` is the
 * parsed (non-stale) start time; `isHydrated` is `true` once the initial async
 * read completes so callers can avoid acting on an unknown value.
 */
export function useSignInPending(): {
  pending: Date | null;
  isHydrated: boolean;
} {
  const { value, isHydrated } = useSecureStorageItem(SIGN_IN_PENDING_KEY);
  return { pending: parseSignInPending(value), isHydrated };
}
