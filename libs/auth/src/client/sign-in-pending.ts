/**
 * Durable "sign-in in flight" marker. The OAuth redirect unloads the web page
 * (and may background the native app), so in-memory modal state is lost mid
 * flow. We persist a small JSON payload in secure storage when sign-in begins
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

export type SignInIntent = 'signIn' | 'addAccount';

export type SignInPending = {
  readonly startedAt: Date;
  readonly intent: SignInIntent;
  /** Session ids present when add-account began (empty for first sign-in). */
  readonly baselineSessionIds: readonly string[];
};

export type MarkSignInPendingOptions = {
  readonly intent?: SignInIntent;
  readonly baselineSessionIds?: readonly string[];
};

type SignInPendingWire = {
  readonly startedAt: string;
  readonly intent: SignInIntent;
  readonly baselineSessionIds: readonly string[];
};

function isSignInIntent(value: unknown): value is SignInIntent {
  return value === 'signIn' || value === 'addAccount';
}

function readBaselineSessionIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
}

function isFreshStartedAt(startedAt: Date): boolean {
  const ms = startedAt.getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms <= SIGN_IN_PENDING_TTL_MS;
}

function parseLegacySignInPending(value: string): SignInPending | null {
  const startedAt = new Date(value);
  if (!isFreshStartedAt(startedAt)) return null;
  return { startedAt, intent: 'signIn', baselineSessionIds: [] };
}

function parseSignInPendingWire(wire: unknown): SignInPending | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const record = wire as Partial<SignInPendingWire>;
  if (typeof record.startedAt !== 'string') return null;
  const startedAt = new Date(record.startedAt);
  if (!isFreshStartedAt(startedAt)) return null;
  return {
    startedAt,
    intent: isSignInIntent(record.intent) ? record.intent : 'signIn',
    baselineSessionIds: readBaselineSessionIds(record.baselineSessionIds),
  };
}

/**
 * Returns a non-stale pending payload, or `null` when there is no marker or it
 * has expired. Accepts legacy bare ISO timestamps (treated as `signIn`).
 */
export function parseSignInPending(value: string | null): SignInPending | null {
  if (value === null || value.length === 0) return null;
  if (!value.startsWith('{')) return parseLegacySignInPending(value);
  try {
    return parseSignInPendingWire(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

export async function markSignInPending(
  storage: SecureStorage,
  options?: MarkSignInPendingOptions
): Promise<void> {
  const wire: SignInPendingWire = {
    startedAt: new Date().toISOString(),
    intent: options?.intent ?? 'signIn',
    baselineSessionIds: options?.baselineSessionIds ?? [],
  };
  await writeSecureStorageItem(
    storage,
    SIGN_IN_PENDING_KEY,
    JSON.stringify(wire)
  );
}

export async function clearSignInPending(
  storage: SecureStorage
): Promise<void> {
  await writeSecureStorageItem(storage, SIGN_IN_PENDING_KEY, null);
}

/**
 * Reactive view of the pending marker for the modal provider. `pending` is the
 * parsed (non-stale) payload; `isHydrated` is `true` once the initial async
 * read completes so callers can avoid acting on an unknown value.
 */
export function useSignInPending(): {
  pending: SignInPending | null;
  isHydrated: boolean;
} {
  const { value, isHydrated } = useSecureStorageItem(SIGN_IN_PENDING_KEY);
  return { pending: parseSignInPending(value), isHydrated };
}
