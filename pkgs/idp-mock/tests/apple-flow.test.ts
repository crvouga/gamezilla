import { describe, expect, test } from 'bun:test';
import { IDP_TEST_IDS } from '@pkgs/idp-mock/shared';
import { decodeJwt } from 'jose';

import {
  type AppleFixture,
  appleAuthorizeUrl,
  appleConsent,
  appleExchange,
  appleSignIn,
  createAppleFixture,
  formPostAction,
  formPostFields,
} from './apple-harness';
import { APPLE_CLIENT_ID, APPLE_REDIRECT_URI } from './example-app';
import { createJWKSSet, jwtVerify } from './verify';

const APPLE_SUB = /^\d{6}\.[0-9a-f]{32}\.\d{4}$/;

/** First authorization for `email`, answering the card with `fields`. */
async function firstAuthorization(
  fixture: AppleFixture,
  email: string,
  fields: Record<string, string> = {}
): Promise<Record<string, string>> {
  const browser = fixture.browser();
  const consent = await appleSignIn(browser, appleAuthorizeUrl(), email);
  expect(consent).toContain(IDP_TEST_IDS.consentPage);
  expect(consent).toContain(IDP_TEST_IDS.consentHideEmail);
  const done = await appleConsent(browser, consent, fields);
  expect(done.status).toBe(200);
  const html = await done.text();
  expect(html).toContain(IDP_TEST_IDS.formPostPage);
  expect(formPostAction(html)).toBe(APPLE_REDIRECT_URI);
  return formPostFields(html);
}

async function idTokenFor(
  fixture: AppleFixture,
  code: string
): Promise<Record<string, unknown>> {
  const res = await appleExchange(fixture, { code });
  expect(res.status).toBe(200);
  const tokens = (await res.json()) as Record<string, unknown>;
  expect(tokens['token_type']).toBe('Bearer');
  expect(tokens['expires_in']).toBe(3600);
  expect(typeof tokens['refresh_token']).toBe('string');
  expect(tokens['scope']).toBeUndefined();
  const keys = await (await fixture.browser().fetch('/auth/keys')).json();
  const verified = await jwtVerify(
    String(tokens['id_token']),
    createJWKSSet(keys as { keys: unknown[] }),
    {
      issuer: 'https://idp.test',
      audience: APPLE_CLIENT_ID,
      currentDate: new Date(fixture.clock.now()),
    }
  );
  return verified.payload as Record<string, unknown>;
}

describe('apple-flavored idp: protocol surface', () => {
  test('serves Apple paths and no userinfo', async () => {
    const fixture = await createAppleFixture();
    const browser = fixture.browser();
    const discovery = (await (
      await browser.fetch('/.well-known/openid-configuration')
    ).json()) as Record<string, unknown>;
    expect(discovery['authorization_endpoint']).toBe(
      'https://idp.test/auth/authorize'
    );
    expect(discovery['response_modes_supported']).toEqual([
      'query',
      'fragment',
      'form_post',
    ]);
    expect(discovery['userinfo_endpoint']).toBeUndefined();
    expect((await browser.fetch('/v1/userinfo')).status).toBe(404);
    expect((await browser.fetch('/o/oauth2/v2/auth')).status).toBe(404);
  });

  test('name/email scopes demand form_post; bad requests render a page', async () => {
    const fixture = await createAppleFixture();
    const browser = fixture.browser();
    const query = await browser.fetch(
      appleAuthorizeUrl({ response_mode: 'query' })
    );
    expect(query.status).toBe(400);
    expect(await query.text()).toContain('form_post');
    const scope = await browser.fetch(appleAuthorizeUrl({ scope: 'profile' }));
    expect(await scope.text()).toContain('invalid_scope');
    const client = await browser.fetch(
      appleAuthorizeUrl({ redirect_uri: 'https://evil.test/cb' })
    );
    expect(client.status).toBe(400);
    expect(client.headers.get('location')).toBeNull();
    const type = await browser.fetch(
      appleAuthorizeUrl({ response_type: 'token' })
    );
    expect(await type.text()).toContain('unsupported_response_type');
  });

  test('an empty scope may answer on the query string', async () => {
    const fixture = await createAppleFixture();
    const browser = fixture.browser();
    const consent = await appleSignIn(
      browser,
      appleAuthorizeUrl({ scope: '', response_mode: 'query' }),
      'alice@icloud.com'
    );
    expect(consent).not.toContain(IDP_TEST_IDS.consentHideEmail);
    const done = await appleConsent(browser, consent);
    const back = new URL(done.headers.get('location') ?? '');
    expect(back.searchParams.get('code')?.startsWith('c')).toBe(true);
    expect(back.searchParams.get('user')).toBeNull();
  });
});

describe('apple-flavored idp: the first authorization is special', () => {
  test('hide my email: relay address, edited name, sent exactly once', async () => {
    const fixture = await createAppleFixture();
    const fields = await firstAuthorization(fixture, 'alice@icloud.com', {
      given_name: 'Ally',
      family_name: 'Renamed',
      email_choice: 'hide',
    });
    expect(fields['state']).toBe('state-apple');
    const user = JSON.parse(fields['user'] ?? '{}') as {
      name: { firstName: string; lastName: string };
      email: string;
    };
    expect(user.name).toEqual({ firstName: 'Ally', lastName: 'Renamed' });
    expect(user.email).toMatch(/@privaterelay\.appleid\.com$/);

    const claims = await idTokenFor(fixture, fields['code'] ?? '');
    expect(String(claims['sub'])).toMatch(APPLE_SUB);
    expect(claims['email']).toBe(user.email);
    expect(claims['is_private_email']).toBe(true);
    expect(claims['email_verified']).toBe(true);
    expect(claims['nonce']).toBe('nonce-apple');
    expect(claims['nonce_supported']).toBe(true);
    expect(claims['real_user_status']).toBe(1);
    expect(claims['name']).toBeUndefined();

    // Second sign-in: a bare confirmation, no `user`, same relay.
    const browser = fixture.browser();
    const again = await appleSignIn(
      browser,
      appleAuthorizeUrl(),
      'alice@icloud.com'
    );
    expect(again).toContain(IDP_TEST_IDS.consentPage);
    expect(again).not.toContain(IDP_TEST_IDS.consentHideEmail);
    const second = formPostFields(
      await (await appleConsent(browser, again)).text()
    );
    expect(second['user']).toBeUndefined();
    const secondClaims = await idTokenFor(fixture, second['code'] ?? '');
    expect(secondClaims['email']).toBe(user.email);
    expect(secondClaims['sub']).toBe(claims['sub']);
    expect(secondClaims['real_user_status']).toBeUndefined();
  });

  test('share my email: the real address and no private flag', async () => {
    const fixture = await createAppleFixture();
    const fields = await firstAuthorization(fixture, 'chris@gmail.com');
    const user = JSON.parse(fields['user'] ?? '{}') as { email: string };
    expect(user.email).toBe('chris@gmail.com');
    const claims = await idTokenFor(fixture, fields['code'] ?? '');
    expect(claims['email']).toBe('chris@gmail.com');
    expect(claims['is_private_email']).toBeUndefined();
  });

  test('cancel posts user_cancelled_authorize back', async () => {
    const fixture = await createAppleFixture();
    const browser = fixture.browser();
    const consent = await appleSignIn(
      browser,
      appleAuthorizeUrl(),
      'bob@icloud.com'
    );
    const done = await appleConsent(browser, consent, { decision: 'deny' });
    const fields = formPostFields(await done.text());
    expect(fields['error']).toBe('user_cancelled_authorize');
    expect(fields['state']).toBe('state-apple');
    expect(fields['code']).toBeUndefined();
  });

  test('code id_token carries a c_hash id_token in the form post', async () => {
    const fixture = await createAppleFixture();
    const browser = fixture.browser();
    const consent = await appleSignIn(
      browser,
      appleAuthorizeUrl({ response_type: 'code id_token' }),
      'bob@icloud.com'
    );
    const fields = formPostFields(
      await (await appleConsent(browser, consent)).text()
    );
    const claims = decodeJwt(fields['id_token'] ?? '');
    expect(typeof claims['c_hash']).toBe('string');
    expect(claims['nonce']).toBe('nonce-apple');
  });
});

describe('apple-flavored idp: token endpoint', () => {
  test('client_secret must be a well-formed ES256 JWT', async () => {
    const fixture = await createAppleFixture();
    const fields = await firstAuthorization(fixture, 'bob@icloud.com');
    const code = fields['code'] ?? '';
    const bad = [
      await fixture.rp.secret({ kid: 'OTHERKEY00' }),
      await fixture.rp.secret({ aud: 'https://idp.test' }),
      await fixture.rp.secret({ iss: 'OTHERTEAM0' }),
      await fixture.rp.secret({ lifetimeS: 15_777_001 }),
      await fixture.rp.secret({ iatMs: fixture.clock.now() - 7_200_000 }),
      'not-a-jwt',
    ];
    for (const secret of bad) {
      const res = await appleExchange(fixture, { code, client_secret: secret });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_client' });
    }
    expect((await appleExchange(fixture, { code })).status).toBe(200);
  });

  test('codes last five minutes and are single use', async () => {
    const fixture = await createAppleFixture();
    const first = await firstAuthorization(fixture, 'bob@icloud.com');
    fixture.advance(5 * 60 * 1000 + 1);
    const late = await appleExchange(fixture, { code: first['code'] ?? '' });
    expect(await late.json()).toMatchObject({ error: 'invalid_grant' });

    const browser = fixture.browser();
    const consent = await appleSignIn(
      browser,
      appleAuthorizeUrl(),
      'bob@icloud.com'
    );
    const code =
      formPostFields(await (await appleConsent(browser, consent)).text())[
        'code'
      ] ?? '';
    expect((await appleExchange(fixture, { code })).status).toBe(200);
    const replay = await appleExchange(fixture, { code });
    expect(await replay.json()).toMatchObject({ error: 'invalid_grant' });
  });

  test('the refresh grant returns an id_token and no new refresh token', async () => {
    const fixture = await createAppleFixture();
    const fields = await firstAuthorization(fixture, 'bob@icloud.com');
    const tokens = (await (
      await appleExchange(fixture, { code: fields['code'] ?? '' })
    ).json()) as Record<string, string>;
    const refreshed = (await (
      await appleExchange(fixture, {
        grant_type: 'refresh_token',
        refresh_token: tokens['refresh_token'] ?? '',
        code: '',
      })
    ).json()) as Record<string, string>;
    expect(typeof refreshed['id_token']).toBe('string');
    expect(refreshed['refresh_token']).toBeUndefined();
  });

  test('revoking the refresh token makes the next sign-in a first one', async () => {
    const fixture = await createAppleFixture();
    const first = await firstAuthorization(fixture, 'alice@icloud.com', {
      email_choice: 'hide',
    });
    const relay = (JSON.parse(first['user'] ?? '{}') as { email: string })
      .email;
    const tokens = (await (
      await appleExchange(fixture, { code: first['code'] ?? '' })
    ).json()) as Record<string, string>;
    const revoke = await fixture.browser().fetch('/auth/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        client_secret: await fixture.rp.secret(),
        token: tokens['refresh_token'] ?? '',
        token_type_hint: 'refresh_token',
      }).toString(),
    });
    expect(revoke.status).toBe(200);
    const again = await firstAuthorization(fixture, 'alice@icloud.com', {
      email_choice: 'hide',
    });
    const user = JSON.parse(again['user'] ?? '{}') as { email: string };
    expect(user.email).toBe(relay);
  });

  test('string booleans, clock skew and unknown keys are reproducible', async () => {
    const fixture = await createAppleFixture();
    await fixture.store.setFaults({
      ...(await fixture.store.faults()),
      stringBooleanClaims: true,
      idTokenClockSkewSeconds: 120,
    });
    const fields = await firstAuthorization(fixture, 'alice@icloud.com', {
      email_choice: 'hide',
    });
    const res = await appleExchange(fixture, { code: fields['code'] ?? '' });
    const idToken = String(
      ((await res.json()) as Record<string, unknown>)['id_token']
    );
    const claims = decodeJwt(idToken);
    expect(claims['email_verified']).toBe('true');
    expect(claims['is_private_email']).toBe('true');
    expect((claims.iat ?? 0) * 1000).toBeGreaterThan(fixture.clock.now());

    await fixture.store.setFaults({
      ...(await fixture.store.faults()),
      idTokenSignedWithUnknownKey: true,
    });
    const next = await firstAuthorization(fixture, 'bob@icloud.com');
    const other = await appleExchange(fixture, { code: next['code'] ?? '' });
    const header = JSON.parse(
      atob(
        String(
          ((await other.json()) as Record<string, unknown>)['id_token']
        ).split('.')[0] ?? ''
      )
    ) as { kid: string };
    expect(header.kid).toBe('unpublished');
  });
});
