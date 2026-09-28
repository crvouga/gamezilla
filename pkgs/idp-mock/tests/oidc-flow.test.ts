import { describe, expect, test } from 'bun:test';
import {
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_PASSWORD,
  IDP_TEST_IDS,
} from '@pkgs/idp-mock/shared';
import {
  createIdpFixture,
  formBody,
  type IdpBrowser,
  requestIdOf,
  submitIdentifier,
  submitPassword,
  TEST_CLIENT,
} from './harness';
import { createJWKSSet, jwtVerify } from './verify';

const REDIRECT_URI = TEST_CLIENT.redirectUris[0] ?? '';
const VERIFIER = 'a'.repeat(64);
/** S256 challenge for VERIFIER, computed by the relying-party side. */
const CHALLENGE = '_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs';

function authorizeUrl(overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    client_id: TEST_CLIENT.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state: 'state-123',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    ...overrides,
  });
  return `/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * A fresh browser is signed in to nobody, so Google asks for the address and
 * then the password; the chooser only appears once a session exists. Both
 * paths are exercised here because relying parties hit both.
 */
async function signInAsAlice(browser: IdpBrowser, url: string): Promise<URL> {
  const page = await browser.fetch(url);
  const html = await page.text();
  expect(html).toContain(IDP_TEST_IDS.identifierPage);
  const identified = await submitIdentifier(browser, html, 'alice@gmail.com');
  return await approveConsent(
    browser,
    await (
      await submitPassword(browser, await identified.text(), IDP_PASSWORD)
    ).text()
  );
}

async function approveConsent(
  browser: IdpBrowser,
  consentHtml: string
): Promise<URL> {
  expect(consentHtml).toContain(IDP_TEST_IDS.consentPage);
  const done = await browser.fetch(
    IDP_AUTHORIZE_SUBMIT_PATH,
    formBody({
      request_id: requestIdOf(consentHtml),
      step: 'consent',
      decision: 'allow',
    })
  );
  expect(done.status).toBe(302);
  return new URL(done.headers.get('location') ?? '');
}

async function exchange(
  idpFetch: (input: string, init?: RequestInit) => Promise<Response>,
  code: string,
  overrides: Record<string, string> = {}
): Promise<Response> {
  return await idpFetch(
    '/token',
    formBody({
      client_id: TEST_CLIENT.clientId,
      client_secret: TEST_CLIENT.clientSecret,
      code,
      code_verifier: VERIFIER,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      ...overrides,
    })
  );
}

describe('simulated google idp', () => {
  test('chooser → consent → code → token → userinfo', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const back = await signInAsAlice(browser, authorizeUrl());
    expect(back.origin + back.pathname).toBe(REDIRECT_URI);
    expect(back.searchParams.get('state')).toBe('state-123');
    const code = back.searchParams.get('code') ?? '';
    expect(code.startsWith('4/0A')).toBe(true);

    const tokenRes = await exchange(browser.fetch, code);
    expect(tokenRes.status).toBe(200);
    const tokens = (await tokenRes.json()) as Record<string, string>;
    expect(tokens['token_type']).toBe('Bearer');
    expect(tokens['access_token']?.startsWith('ya29.')).toBe(true);
    expect(tokens['scope']).toBe('openid email profile');

    const userRes = await browser.fetch('/v1/userinfo', {
      headers: { authorization: `Bearer ${tokens['access_token'] ?? ''}` },
    });
    expect(userRes.status).toBe(200);
    const profile = (await userRes.json()) as Record<string, unknown>;
    expect(profile['email']).toBe('alice@gmail.com');
    expect(profile['email_verified']).toBe(true);
    expect(typeof profile['sub']).toBe('string');
  });

  test('id_token verifies against the published JWKS', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const back = await signInAsAlice(browser, authorizeUrl());
    const tokenRes = await exchange(
      browser.fetch,
      back.searchParams.get('code') ?? ''
    );
    const tokens = (await tokenRes.json()) as Record<string, string>;
    const certs = await (await browser.fetch('/oauth2/v3/certs')).json();
    const verified = await jwtVerify(
      tokens['id_token'] ?? '',
      createJWKSSet(certs as { keys: unknown[] }),
      {
        issuer: 'https://idp.test',
        audience: TEST_CLIENT.clientId,
        currentDate: new Date(Date.parse('2024-06-01T00:10:00.000Z')),
      }
    );
    expect(verified.payload['email']).toBe('alice@gmail.com');
    expect(verified.payload['azp']).toBe(TEST_CLIENT.clientId);
    expect(typeof verified.payload['at_hash']).toBe('string');
  });

  test('authorization code is single use and kills the grant on replay', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const back = await signInAsAlice(browser, authorizeUrl());
    const code = back.searchParams.get('code') ?? '';
    const first = await exchange(browser.fetch, code);
    const tokens = (await first.json()) as Record<string, string>;
    const replay = await exchange(browser.fetch, code);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toMatchObject({ error: 'invalid_grant' });

    const after = await browser.fetch('/v1/userinfo', {
      headers: { authorization: `Bearer ${tokens['access_token'] ?? ''}` },
    });
    expect(after.status).toBe(401);
  });

  test('PKCE verifier is checked', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const back = await signInAsAlice(browser, authorizeUrl());
    const res = await exchange(
      browser.fetch,
      back.searchParams.get('code') ?? '',
      { code_verifier: 'b'.repeat(64) }
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error_description: expect.stringContaining('verifier'),
    });
  });

  test('expired codes are rejected', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const back = await signInAsAlice(browser, authorizeUrl());
    fixture.advance(11 * 60 * 1000);
    const res = await exchange(
      browser.fetch,
      back.searchParams.get('code') ?? ''
    );
    expect(await res.json()).toMatchObject({
      error_description: expect.stringContaining('expired'),
    });
  });
});
