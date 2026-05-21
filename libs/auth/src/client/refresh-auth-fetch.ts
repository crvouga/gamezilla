import { assert } from '@pkgs/assert';

/** Must match {@link ANON_ID_HEADER} in libs/auth session-middleware. */
const X_ANON_ID = 'x-anon-id';

export type RefreshAuthArgs = {
  apiUrl: string;
  bearerToken: string;
  deviceId: string;
  /**
   * Best-effort device metadata keyed directly by `device/...` PatchDB
   * attribute names (see {@link collectDeviceSnapshot}). The server merges
   * these into `device/<deviceId>` verbatim — no field-name remapping.
   */
  deviceSnapshot: Record<string, string>;
  /**
   * ISO timestamp the client expects this session to expire at. Stored on
   * `account/session.expiresAt`; the server uses it to decide when a row is
   * considered stale.
   */
  accountSessionExpiresAt: string;
};

export type RefreshAuthResult = {
  accountId: string;
};

/**
 * `POST /auth/refresh` — idempotent server upsert of the auth-related PatchDB
 * entities (`account`, `account/provider`, `account/session`, `device`) for the
 * current bearer + device. Returns just the internal `accountId`; everything
 * else flows back to the client through PatchDB sync.
 */
export async function refreshAuth(
  args: RefreshAuthArgs
): Promise<RefreshAuthResult> {
  const {
    apiUrl,
    bearerToken,
    deviceId,
    deviceSnapshot,
    accountSessionExpiresAt,
  } = args;
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/auth/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      [X_ANON_ID]: deviceId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      device: deviceSnapshot,
      accountSessionExpiresAt,
    }),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text.length > 0 ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error(
      `auth/refresh response was not JSON (status ${String(res.status)}): ${text}`
    );
  }
  if (!res.ok) {
    assert.record(json, 'auth/refresh error body');
    const err = json['error'];
    throw new Error(
      typeof err === 'string'
        ? err
        : `auth/refresh failed (${String(res.status)}): ${text}`
    );
  }
  assert.record(json, 'auth/refresh success body');
  const accountId = json['accountId'];
  assert.string(accountId, 'auth/refresh accountId');
  return { accountId };
}
