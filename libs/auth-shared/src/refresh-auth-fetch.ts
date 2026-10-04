import { assert } from '@pkgs/assert-shared/singleton';
import type { HttpFetch } from '@pkgs/http-client-shared/types';

/** Must match {@link ANON_ID_HEADER} in libs/auth session-middleware. */
const X_ANON_ID = 'x-anon-id';

export type RefreshAuthArgs = {
  apiUrl: string;
  bearerToken: string;
  deviceId: string;
  fetchFn: HttpFetch;
  /**
   * Best-effort device metadata keyed directly by `device/...` sync
   * attribute names (see {@link collectDeviceSnapshot}). The server merges
   * these into `device/<deviceId>` verbatim — no field-name remapping.
   */
  deviceSnapshot: Record<string, string>;
};

export type RefreshAuthResult = {
  accountId: string;
};

/** Non-OK `POST /identity/refresh` — carries HTTP status for recovery branching. */
export class RefreshAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'RefreshAuthError';
    this.status = status;
  }
}

/** Dead / expired bearer — clear local capability and fall through to anon. */
export function isUnauthorizedRefreshError(err: unknown): boolean {
  return (
    err instanceof RefreshAuthError &&
    (err.status === 401 || err.status === 403)
  );
}

/**
 * `POST /identity/refresh` — idempotent server upsert of the auth-related sync
 * entities (auth user snapshot, device binding) for the current bearer +
 * device. Returns just the internal `accountId`; everything else flows back
 * to the client through sync sync.
 */
export async function refreshAuth(
  args: RefreshAuthArgs
): Promise<RefreshAuthResult> {
  const { apiUrl, bearerToken, deviceId, fetchFn, deviceSnapshot } = args;
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetchFn(`${base}/api/identity/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      [X_ANON_ID]: deviceId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      device: deviceSnapshot,
    }),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text.length > 0 ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new RefreshAuthError(
      res.status,
      `auth/refresh response was not JSON (status ${String(res.status)}): ${text}`
    );
  }
  if (!res.ok) {
    assert.record(json, 'auth/refresh error body');
    const err = json['error'];
    throw new RefreshAuthError(
      res.status,
      typeof err === 'string'
        ? err
        : `auth/refresh failed (${String(res.status)}): ${text}`
    );
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    // Empty 2xx (Hono/RN wiped body) — recoverable like a dead session.
    throw new RefreshAuthError(
      401,
      `auth/refresh empty/non-object body (status ${String(res.status)}, bytes ${String(text.length)}): ${text}`
    );
  }
  assert.record(json, 'auth/refresh success body');
  const accountId = json['accountId'];
  assert.string(accountId, 'auth/refresh accountId');
  return { accountId };
}
