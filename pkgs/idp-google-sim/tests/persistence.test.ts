/**
 * Durability: what the provider remembers is a property of the SQLite file it
 * was handed, and nothing else.
 */

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  IDP_ACCESS_TOKEN_TTL_MS,
  IDP_AUTH_CODE_TTL_MS,
  IDP_AUTH_REQUEST_TTL_MS,
} from '@pkgs/idp-google-sim/server';
import {
  IDP_ADMIN_PREFIX,
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_PASSWORD,
} from '@pkgs/idp-google-sim/shared';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';

import {
  allowConsent,
  authorizeUrl,
  codeOf,
  createAccountViaScreen,
  createIdpFixture,
  createTestClock,
  createTestIdStream,
  exchangeBody,
  formBody,
  openIdpFixture,
  requestIdOf,
  signInWithPassword,
  TEST_CLIENT,
} from './harness';

type Json = Record<string, unknown>;

async function jsonOf(response: Response): Promise<Json> {
  return (await response.json()) as Json;
}

async function userinfoOf(
  browser: { fetch(input: string, init?: RequestInit): Promise<Response> },
  token: string
): Promise<Response> {
  return await browser.fetch('/v1/userinfo', {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('idp storage durability', () => {
  test('a file-backed store survives a restart, signing key included', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idp-sim-'));
    const file = join(dir, 'idp.sqlite');
    const clock = createTestClock('2024-06-01T00:00:00.000Z');
    try {
      const first = SqlClientImplBunSqlite.open(file);
      await first.connect();
      const a = await openIdpFixture({ sqlClient: first, clock });
      const browser = a.browser();
      const signInPage = await (await browser.fetch(authorizeUrl())).text();
      const created = await createAccountViaScreen(browser, signInPage, {
        name: 'Carol Danvers',
        email: 'carol@example.com',
      });
      const consentHtml = await created.text();
      const code = codeOf(await allowConsent(browser, consentHtml));
      const tokens = await jsonOf(
        await browser.fetch('/token', exchangeBody({ code }))
      );
      const accessToken = String(tokens['access_token']);
      expect((await userinfoOf(browser, accessToken)).status).toBe(200);
      const kid = a.store.keys.kid;
      await a.close();

      const second = SqlClientImplBunSqlite.open(file);
      await second.connect();
      // A restart mints fresh ids; reusing the test stream would collide.
      const b = await openIdpFixture({
        sqlClient: second,
        clock,
        createId: createTestIdStream('b-'),
      });
      try {
        expect(
          await b.store.accountByEmail('carol@example.com')
        ).not.toBeNull();
        expect(b.store.keys.kid).toBe(kid);
        // A durable token issued before the restart still resolves.
        const after = await userinfoOf(b.browser(), accessToken);
        expect(after.status).toBe(200);
        expect((await jsonOf(after))['email']).toBe('carol@example.com');
        // The approved grant survived too: no consent screen this time.
        const again = await signInWithPassword(
          b.browser(),
          authorizeUrl(),
          'carol@example.com'
        );
        expect(again.status).toBe(302);
        expect(codeOf(again).startsWith('4/0A')).toBe(true);
      } finally {
        await b.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('memory mode starts clean every time', async () => {
    const first = await createIdpFixture();
    await first.store.upsertAccount({
      email: 'ghost@example.com',
      name: 'Ghost Writer',
    });
    await first.close();

    const second = await createIdpFixture();
    try {
      expect(await second.store.accountByEmail('ghost@example.com')).toBeNull();
      expect((await second.store.accounts()).map((a) => a.email)).toEqual([
        'alice@gmail.com',
        'bob@gmail.com',
        'chris@gmail.com',
        'dan@gmail.com',
        'ed@gmail.com',
        'fred@gmail.com',
      ]);
    } finally {
      await second.close();
    }
  });

  test('overlapping transactions serialize on one connection', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idp-sim-tx-'));
    const client = SqlClientImplBunSqlite.open(join(dir, 'idp.sqlite'));
    await client.connect();
    const fixture = await openIdpFixture({ sqlClient: client });
    try {
      // One SQLite connection cannot hold two open transactions; two tabs can
      // submit at the same moment, so the store must queue them.
      await Promise.all([
        fixture.store.tx(async (tx) => {
          await tx.upsertAccount({ email: 'one@example.com', name: 'One' });
          await tx.upsertAccount({ email: 'two@example.com', name: 'Two' });
        }),
        fixture.store.tx(async (tx) => {
          await tx.upsertAccount({ email: 'three@example.com', name: 'Three' });
          await tx.upsertAccount({ email: 'four@example.com', name: 'Four' });
        }),
        fixture.store.tx(async (tx) => {
          await tx.setFaults({
            ...(await tx.faults()),
            tokenEndpoint: 'server_error',
          });
        }),
      ]);
      const emails = (await fixture.store.accounts()).map((a) => a.email);
      expect(emails).toContain('one@example.com');
      expect(emails).toContain('four@example.com');
      expect(emails.length).toBe(10);
      expect((await fixture.store.faults()).tokenEndpoint).toBe('server_error');
    } finally {
      await fixture.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('idp expiry + reset', () => {
  test('parked requests, codes and tokens are swept when their TTL passes', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();

    const page = await (await browser.fetch(authorizeUrl())).text();
    const requestId = requestIdOf(page);
    expect(await fixture.store.authRequest(requestId)).not.toBeNull();
    fixture.advance(IDP_AUTH_REQUEST_TTL_MS + 1);
    await fixture.store.sweepExpired();
    expect(await fixture.store.authRequest(requestId)).toBeNull();
    const stale = await browser.fetch(
      IDP_AUTHORIZE_SUBMIT_PATH,
      formBody({
        request_id: requestId,
        step: 'password',
        email: 'alice@gmail.com',
        password: IDP_PASSWORD,
      })
    );
    expect(stale.status).toBe(400);

    const code = codeOf(
      await signInWithPassword(browser, authorizeUrl(), 'alice@gmail.com')
    );
    expect(await fixture.store.authCode(code)).not.toBeNull();
    fixture.advance(IDP_AUTH_CODE_TTL_MS + 1);
    const late = await browser.fetch('/token', exchangeBody({ code }));
    expect((await jsonOf(late))['error_description']).toContain('expired');

    const fresh = codeOf(
      await signInWithPassword(browser, authorizeUrl(), 'alice@gmail.com')
    );
    const tokens = await jsonOf(
      await browser.fetch('/token', exchangeBody({ code: fresh }))
    );
    const accessToken = String(tokens['access_token']);
    fixture.advance(IDP_ACCESS_TOKEN_TTL_MS + 1);
    expect((await userinfoOf(browser, accessToken)).status).toBe(401);
    await fixture.store.sweepExpired();
    expect(await fixture.store.accessToken(accessToken)).toBeNull();
  });

  test('reset clears runtime state and faults but keeps the directory', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const code = codeOf(
      await signInWithPassword(browser, authorizeUrl(), 'alice@gmail.com')
    );
    const tokens = await jsonOf(
      await browser.fetch('/token', exchangeBody({ code }))
    );
    await fixture.store.setFaults({
      ...(await fixture.store.faults()),
      denyConsent: true,
    });

    const reset = await browser.fetch(`${IDP_ADMIN_PREFIX}/reset`, {
      method: 'POST',
    });
    expect(reset.status).toBe(200);
    expect(
      await fixture.store.accessToken(String(tokens['access_token']))
    ).toBeNull();
    expect((await fixture.store.faults()).denyConsent).toBe(false);
    expect(
      await fixture.store.accountByEmail('alice@gmail.com')
    ).not.toBeNull();

    const state = await jsonOf(
      await browser.fetch(`${IDP_ADMIN_PREFIX}/state`)
    );
    expect(state['sessions']).toEqual([]);
    expect(state['grants']).toEqual([]);
    expect(state['pendingAuthRequests']).toBe(0);
    expect(state['liveAccessTokens']).toBe(0);
    expect(state['clients']).toEqual([TEST_CLIENT.clientId]);
    const accounts = state['accounts'] as readonly { readonly email: string }[];
    expect(accounts.map((a) => a.email)).toContain('alice@gmail.com');
  });
});
