import { assert } from '@gamezilla/lib/assert';

/** Must match {@link ANON_ID_HEADER} in apps/api session-middleware. */
const X_ANON_ID = 'x-anon-id';

/** Must match apps/api `GET /auth/whoami`. */
export async function fetchAuthWhoAmI(args: {
  apiUrl: string;
  clerkJwt: string;
  deviceId: string;
}): Promise<{ accountId: string }> {
  const { apiUrl, clerkJwt, deviceId } = args;
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/auth/whoami`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${clerkJwt}`,
      [X_ANON_ID]: deviceId,
    },
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text.length > 0 ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error(
      `whoami response was not JSON (status ${String(res.status)}): ${text}`
    );
  }
  if (!res.ok) {
    assert.record(json, 'whoami error body');
    const err = json['error'];
    throw new Error(
      typeof err === 'string'
        ? err
        : `whoami failed (${String(res.status)}): ${text}`
    );
  }
  assert.record(json, 'whoami success body');
  const accountId = json['accountId'];
  assert.string(accountId, 'whoami accountId');
  return { accountId };
}
