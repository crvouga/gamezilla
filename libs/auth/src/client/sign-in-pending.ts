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

/** Fallback when no safe return path was stored (or it was the callback itself). */
export const SIGN_IN_RETURN_FALLBACK_HREF = '/(tabs)';

export type SignInPending = {
  readonly startedAt: Date;
  /**
   * App path (+ search) to restore after `/sso-callback`. Omitted when unknown
   * or unsafe (callback route / absolute URL).
   */
  readonly returnHref?: string;
};

export type MarkSignInPendingOptions = {
  readonly returnHref?: string;
};

type SignInPendingWire = {
  readonly startedAt: string;
  readonly returnHref?: string;
};

function isFreshStartedAt(startedAt: Date): boolean {
  const ms = startedAt.getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms <= SIGN_IN_PENDING_TTL_MS;
}

/**
 * Reject open redirects and the OAuth handoff route itself. Relative app paths
 * (optionally with `?` / `#`) are kept.
 */
export function sanitizeSignInReturnHref(
  href: string | null | undefined
): string | undefined {
  if (href === null || href === undefined) return undefined;
  const trimmed = href.trim();
  if (trimmed.length === 0) return undefined;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return undefined;
  if (trimmed.startsWith('//')) return undefined;
  const pathOnly = trimmed.split(/[?#]/)[0] ?? trimmed;
  if (pathOnly === '/sso-callback' || pathOnly.endsWith('/sso-callback')) {
    return undefined;
  }
  return trimmed;
}

/** Current screen to restore after hosted OAuth (web prefers `window.location`). */
export function resolveSignInReturnHref(pathname: string): string | undefined {
  if (typeof window !== 'undefined') {
    return sanitizeSignInReturnHref(
      `${window.location.pathname}${window.location.search}`
    );
  }
  return sanitizeSignInReturnHref(pathname);
}

/** Href used by `/sso-callback` after the pending marker is available. */
export function signInReturnHrefFromPending(
  pending: SignInPending | null
): string {
  return (
    sanitizeSignInReturnHref(pending?.returnHref) ??
    SIGN_IN_RETURN_FALLBACK_HREF
  );
}

/**
 * Sync read for `/sso-callback` handoff. Must not wait on async secure-storage
 * hydration — that path can stall and leave the blank callback mounted forever.
 * Web reads `localStorage` directly (same backend as {@link createWebSecureStorage}).
 */
export function readSignInPendingSync(): SignInPending | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  try {
    return parseSignInPending(
      globalThis.localStorage.getItem(SIGN_IN_PENDING_KEY)
    );
  } catch {
    return null;
  }
}

function parseLegacySignInPending(value: string): SignInPending | null {
  const startedAt = new Date(value);
  if (!isFreshStartedAt(startedAt)) return null;
  return { startedAt };
}

function parseSignInPendingWire(wire: unknown): SignInPending | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const record = wire as Partial<SignInPendingWire>;
  if (typeof record.startedAt !== 'string') return null;
  const startedAt = new Date(record.startedAt);
  if (!isFreshStartedAt(startedAt)) return null;
  const returnHref = sanitizeSignInReturnHref(
    typeof record.returnHref === 'string' ? record.returnHref : undefined
  );
  return {
    startedAt,
    ...(returnHref !== undefined ? { returnHref } : {}),
  };
}

/**
 * Returns a non-stale pending payload, or `null` when there is no marker or it
 * has expired. Accepts legacy bare ISO timestamps.
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
  const returnHref = sanitizeSignInReturnHref(options?.returnHref);
  const wire: SignInPendingWire = {
    startedAt: new Date().toISOString(),
    ...(returnHref !== undefined ? { returnHref } : {}),
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
