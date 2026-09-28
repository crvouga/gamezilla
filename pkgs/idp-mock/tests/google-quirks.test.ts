import { describe, expect, test } from 'bun:test';
import { idpSubOf } from '@pkgs/idp-mock/shared';
import { decodeJwt } from 'jose';
import { GOOGLE_CLIENT } from './example-app';
import {
  authorizeUrl,
  codeOf,
  createIdpFixture,
  exchangeBody,
  type IdpFixture,
  signInWithPassword,
} from './harness';
import { createJWKSSet, jwtVerify } from './verify';

async function tokensFor(
  fixture: IdpFixture,
  email: string,
  overrides: Record<string, string> = {}
): Promise<Record<string, string>> {
  const browser = fixture.browser();
  const back = await signInWithPassword(
    browser,
    authorizeUrl(overrides),
    email
  );
  const res = await browser.fetch(
    '/token',
    exchangeBody({ code: codeOf(back) })
  );
  return (await res.json()) as Record<string, string>;
}

describe('google-flavored quirks relying parties must survive', () => {
  test('an unverified address says so in userinfo and the id_token', async () => {
    const fixture = await createIdpFixture();
    const tokens = await tokensFor(fixture, 'uma@unverified.test');
    expect(decodeJwt(tokens['id_token'] ?? '')['email_verified']).toBe(false);
    const profile = (await (
      await fixture.browser().fetch('/v1/userinfo', {
        headers: { authorization: `Bearer ${tokens['access_token'] ?? ''}` },
      })
    ).json()) as Record<string, unknown>;
    expect(profile['email_verified']).toBe(false);
  });

  test('workspace accounts carry hd', async () => {
    const fixture = await createIdpFixture();
    const tokens = await tokensFor(fixture, 'wendy@workspace.test');
    expect(decodeJwt(tokens['id_token'] ?? '')['hd']).toBe('workspace.test');
  });

  test('without the email scope there is no address anywhere', async () => {
    const fixture = await createIdpFixture();
    const tokens = await tokensFor(fixture, 'alice@gmail.com', {
      scope: 'openid profile',
    });
    const claims = decodeJwt(tokens['id_token'] ?? '');
    expect(claims['email']).toBeUndefined();
    expect(claims['name']).toBe('Alice Tester');
  });

  test('changing the address keeps the subject', async () => {
    const fixture = await createIdpFixture();
    const sub = idpSubOf('alice@gmail.com');
    await fixture.store.upsertAccount({
      sub,
      handle: 'alice',
      email: 'alice.new@gmail.com',
    });
    const tokens = await tokensFor(fixture, 'alice.new@gmail.com');
    const claims = decodeJwt(tokens['id_token'] ?? '');
    expect(claims['sub']).toBe(sub);
    expect(claims['email']).toBe('alice.new@gmail.com');
  });

  test('a rotated key keeps the previous one published', async () => {
    const fixture = await createIdpFixture();
    const before = await tokensFor(fixture, 'bob@gmail.com');
    const rotated = await fixture.browser().fetch('/__idp/keys/rotate', {
      method: 'POST',
    });
    const { kid } = (await rotated.json()) as { kid: string };
    const certs = (await (
      await fixture.browser().fetch('/oauth2/v3/certs')
    ).json()) as { keys: { kid: string }[] };
    expect(certs.keys.map((key) => key.kid)[0]).toBe(kid);
    expect(certs.keys).toHaveLength(2);
    const jwks = createJWKSSet(certs);
    const options = {
      audience: GOOGLE_CLIENT.clientId,
      currentDate: new Date(fixture.clock.now()),
    };
    await jwtVerify(before['id_token'] ?? '', jwks, options);
    const after = await tokensFor(fixture, 'bob@gmail.com');
    const verified = await jwtVerify(after['id_token'] ?? '', jwks, options);
    expect(verified.protectedHeader.kid).toBe(kid);
  });

  test('revoking access brings the consent card back', async () => {
    const fixture = await createIdpFixture();
    await tokensFor(fixture, 'bob@gmail.com');
    await fixture.browser().fetch('/__idp/grants/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sub: idpSubOf('bob@gmail.com'),
        clientId: GOOGLE_CLIENT.clientId,
      }),
    });
    expect(
      await fixture.store.hasGrant(
        idpSubOf('bob@gmail.com'),
        GOOGLE_CLIENT.clientId,
        ['openid']
      )
    ).toBe(false);
  });

  test('a deleted account can no longer redeem its codes', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const back = await signInWithPassword(
      browser,
      authorizeUrl(),
      'dan@gmail.com'
    );
    await browser.fetch(`/__idp/accounts/${idpSubOf('dan@gmail.com')}`, {
      method: 'DELETE',
    });
    const res = await browser.fetch(
      '/token',
      exchangeBody({ code: codeOf(back) })
    );
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' });
  });
});
