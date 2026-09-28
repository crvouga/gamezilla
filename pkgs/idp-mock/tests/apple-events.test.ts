import { describe, expect, test } from 'bun:test';
import { appleSubOf } from '@pkgs/idp-mock/shared';

import {
  APPLE_CLIENT_ID,
  APPLE_NOTIFICATION_URL,
  type AppleFixture,
  appleAuthorizeUrl,
  appleConsent,
  appleSignIn,
  createAppleFixture,
  formPostFields,
} from './apple-harness';
import { createJWKSSet, jwtVerify } from './verify';

const ALICE = appleSubOf('alice@icloud.com');

async function authorize(fixture: AppleFixture, choice: 'share' | 'hide') {
  const browser = fixture.browser();
  const consent = await appleSignIn(
    browser,
    appleAuthorizeUrl(),
    'alice@icloud.com'
  );
  return formPostFields(
    await (
      await appleConsent(browser, consent, { email_choice: choice })
    ).text()
  );
}

async function admin(
  fixture: AppleFixture,
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fixture.browser().fetch(`/__idp${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Record<string, unknown>;
}

/** Verify a delivered notification the way the relying party must. */
async function eventsOf(
  fixture: AppleFixture,
  index: number
): Promise<Record<string, unknown>> {
  const delivery = fixture.delivered[index];
  expect(delivery?.url).toBe(APPLE_NOTIFICATION_URL);
  const { payload } = JSON.parse(delivery?.body ?? '{}') as { payload: string };
  const keys = await (await fixture.browser().fetch('/auth/keys')).json();
  const verified = await jwtVerify(
    payload,
    createJWKSSet(keys as { keys: unknown[] }),
    {
      issuer: 'https://idp.test',
      audience: APPLE_CLIENT_ID,
      currentDate: new Date(fixture.clock.now()),
    }
  );
  // `events` is a JSON *string*, not an object.
  expect(typeof verified.payload['events']).toBe('string');
  return JSON.parse(String(verified.payload['events'])) as Record<
    string,
    unknown
  >;
}

describe('apple server-to-server notifications', () => {
  test('consent-revoked drops the grant and is delivered signed', async () => {
    const fixture = await createAppleFixture();
    await authorize(fixture, 'share');
    const result = await admin(fixture, '/grants/revoke', {
      sub: ALICE,
      clientId: APPLE_CLIENT_ID,
    });
    expect(result['delivered']).toBe(true);
    const events = await eventsOf(fixture, 0);
    expect(events['type']).toBe('consent-revoked');
    expect(events['sub']).toBe(ALICE);
    expect(await fixture.store.grant(ALICE, APPLE_CLIENT_ID)).toBeNull();
    // The next sign-in is a first authorization: the `user` blob returns.
    const again = await authorize(fixture, 'share');
    expect(again['user']).toBeDefined();
  });

  test('email-disabled / email-enabled toggle relay forwarding', async () => {
    const fixture = await createAppleFixture();
    const fields = await authorize(fixture, 'hide');
    const relay = (JSON.parse(fields['user'] ?? '{}') as { email: string })
      .email;
    await admin(fixture, '/events', {
      type: 'email-disabled',
      sub: ALICE,
      clientId: APPLE_CLIENT_ID,
    });
    const disabled = await eventsOf(fixture, 0);
    expect(disabled).toMatchObject({
      type: 'email-disabled',
      email: relay,
      is_private_email: 'true',
    });
    expect((await fixture.store.relayAddressByEmail(relay))?.forwarding).toBe(
      false
    );
    await admin(fixture, '/events', {
      type: 'email-enabled',
      sub: ALICE,
      clientId: APPLE_CLIENT_ID,
    });
    expect((await eventsOf(fixture, 1))['type']).toBe('email-enabled');
    expect((await fixture.store.relayAddressByEmail(relay))?.forwarding).toBe(
      true
    );
  });

  test('account-delete removes the account and tells every authorized app', async () => {
    const fixture = await createAppleFixture();
    await authorize(fixture, 'share');
    const res = await fixture.browser().fetch(`/__idp/accounts/${ALICE}`, {
      method: 'DELETE',
    });
    const body = (await res.json()) as { deliveries: unknown[] };
    expect(body.deliveries).toHaveLength(1);
    expect((await eventsOf(fixture, 0))['type']).toBe('account-delete');
    expect(await fixture.store.accountBySub(ALICE)).toBeNull();
  });

  test('without egress an event is recorded as undeliverable', async () => {
    const fixture = await createAppleFixture();
    await authorize(fixture, 'share');
    const detached = { ...fixture.idp.ctx, http: null };
    const { emitAppleEvent } = await import('@pkgs/idp-mock/server');
    const result = await emitAppleEvent(detached, {
      type: 'consent-revoked',
      sub: ALICE,
      clientId: APPLE_CLIENT_ID,
      issuer: 'https://idp.test',
    });
    expect('delivered' in result && result.delivered).toBe(false);
  });
});
