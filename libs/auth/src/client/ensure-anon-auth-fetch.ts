import { assert } from '@pkgs/assert';

/** Must match {@link ANON_ID_HEADER} in libs/auth session-middleware. */
const X_ANON_ID = 'x-anon-id';

export type EnsureAnonAuthArgs = {
  readonly apiUrl: string;
  readonly deviceId: string;
  /** When true, mint a fresh anon user and rebind the device (sign-out). */
  readonly forceNew?: boolean;
};

export type EnsureAnonAuthResult = {
  readonly userId: string;
  readonly isAnon: true;
};

/**
 * `POST /identity/anon/ensure` — mint or reuse an anon `users` row for this install.
 */
export async function ensureAnonAuth(
  args: EnsureAnonAuthArgs
): Promise<EnsureAnonAuthResult> {
  const { apiUrl, deviceId, forceNew = false } = args;
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/identity/anon/ensure`, {
    method: 'POST',
    headers: {
      [X_ANON_ID]: deviceId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ forceNew }),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text.length > 0 ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error(
      `auth/anon/ensure response was not JSON (status ${String(res.status)}): ${text}`
    );
  }
  if (!res.ok) {
    assert.record(json, 'auth/anon/ensure error body');
    const err = json['error'];
    throw new Error(
      typeof err === 'string'
        ? err
        : `auth/anon/ensure failed (${String(res.status)}): ${text}`
    );
  }
  assert.record(json, 'auth/anon/ensure success body');
  const userId = json['userId'] ?? json['accountId'];
  assert.string(userId, 'auth/anon/ensure userId');
  return { userId, isAnon: true };
}
