import { assert } from '@gamezilla/shared/assert';

export type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  aud?: string;
};

const GOOGLE_TOKENINFO_TIMEOUT_MS = 10_000;

/**
 * Verifies a Google OIDC id_token via Google's tokeninfo endpoint.
 * Rejects invalid tokens — never continues on failure.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options?: { expectedAudience?: string }
): Promise<GoogleIdTokenClaims> {
  assert.string(idToken, 'google id_token must be string');
  assert.ok(idToken.length > 0, 'google id_token must be non-empty');
  assert.ok(
    idToken.length <= 8192,
    'google id_token exceeds maximum length',
    { length: idToken.length }
  );

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    GOOGLE_TOKENINFO_TIMEOUT_MS
  );

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Google token verification timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google token verification failed (${String(res.status)})`);
  }
  let json: unknown;
  try {
    json = text.length > 0 ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error('Google tokeninfo response was not JSON');
  }

  assert.record(json, 'Google tokeninfo must be an object');

  const sub = json['sub'];
  const email = json['email'];
  assert.string(sub, 'Google token must include sub');
  assert.string(email, 'Google token must include email');

  const aud = json['aud'];
  if (options?.expectedAudience !== undefined) {
    assert.ok(
      aud === options.expectedAudience,
      'Google token aud must match expected client id',
      { aud, expected: options.expectedAudience }
    );
  }

  if (typeof aud === 'string') {
    return { sub, email, aud };
  }
  return { sub, email };
}
