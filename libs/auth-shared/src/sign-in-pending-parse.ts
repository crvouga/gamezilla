/**
 * Pure parse / sanitize helpers for the durable "sign-in in flight" marker.
 * Framework-free so `bun test` suites can exercise them without loading JSX.
 */

import type { SecureStorageStore } from '@pkgs/secure-storage-root-shared/secure-storage-store';
import { writeSecureStorageItem } from '@pkgs/secure-storage-root-shared/secure-storage-store';

import { SIGN_IN_PENDING_KEY } from './auth-storage-keys';

/** A sign-in marker older than this is considered abandoned. */
export const SIGN_IN_PENDING_TTL_MS = 30 * 60 * 1000;

/** Fallback when no safe return path was stored (or it was the callback itself). */
export const SIGN_IN_RETURN_FALLBACK_HREF = '/';

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

function isFreshStartedAt(startedAt: Date, now: () => number): boolean {
  const ms = startedAt.getTime();
  if (Number.isNaN(ms)) return false;
  return now() - ms <= SIGN_IN_PENDING_TTL_MS;
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
export function readSignInPendingSync(now: () => number): SignInPending | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  try {
    return parseSignInPending(
      globalThis.localStorage.getItem(SIGN_IN_PENDING_KEY),
      now
    );
  } catch {
    return null;
  }
}

function parseLegacySignInPending(
  value: string,
  now: () => number
): SignInPending | null {
  const startedAt = new Date(value);
  if (!isFreshStartedAt(startedAt, now)) return null;
  return { startedAt };
}

function parseSignInPendingWire(
  wire: unknown,
  now: () => number
): SignInPending | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const record = wire as Partial<SignInPendingWire>;
  if (typeof record.startedAt !== 'string') return null;
  const startedAt = new Date(record.startedAt);
  if (!isFreshStartedAt(startedAt, now)) return null;
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
export function parseSignInPending(
  value: string | null,
  now: () => number
): SignInPending | null {
  if (value === null || value.length === 0) return null;
  if (!value.startsWith('{')) return parseLegacySignInPending(value, now);
  try {
    return parseSignInPendingWire(JSON.parse(value) as unknown, now);
  } catch {
    return null;
  }
}

export class SignInPendingStore {
  constructor(private readonly store: SecureStorageStore) {}

  async mark(
    now: () => number,
    options?: MarkSignInPendingOptions
  ): Promise<void> {
    const returnHref = sanitizeSignInReturnHref(options?.returnHref);
    const wire: SignInPendingWire = {
      startedAt: new Date(now()).toISOString(),
      ...(returnHref !== undefined ? { returnHref } : {}),
    };
    await writeSecureStorageItem(
      this.store,
      SIGN_IN_PENDING_KEY,
      JSON.stringify(wire)
    );
  }

  async clear(): Promise<void> {
    await writeSecureStorageItem(this.store, SIGN_IN_PENDING_KEY, null);
  }
}
