/**
 * The `/rpc/*` path: the browser app's step transitions reach the same store
 * effects as the HTML forms — a real authorization code, exchanged for tokens
 * for the right account, and create-account rows that survive a restart.
 */

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  IDP_ADMIN_PREFIX,
  IDP_PASSWORD,
  type IdpScreenOutcome,
} from '@pkgs/idp-sim/shared';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';

import {
  authorizeUrl,
  createIdpFixture,
  createTestIdStream,
  exchangeBody,
  type IdpBrowser,
  openIdpFixture,
  requestIdOf,
} from './harness';

function jsonBody(body: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function parse(response: Response): Promise<IdpScreenOutcome> {
  expect(response.status).toBe(200);
  return (await response.json()) as IdpScreenOutcome;
}

async function submit(
  browser: IdpBrowser,
  path: string,
  body: Record<string, string>
): Promise<IdpScreenOutcome> {
  return await parse(await browser.fetch(`/rpc/${path}`, jsonBody(body)));
}

/** The screen kind a step landed on, or `redirect` when it handed back a URL. */
function kindOf(result: IdpScreenOutcome): string {
  return result.kind === 'screen' ? result.state.kind : 'redirect';
}

function locationOf(result: IdpScreenOutcome): string {
  if (result.kind !== 'redirect') throw new Error('expected a redirect');
  return result.location;
}

describe('idp step RPC', () => {
  test('identifier → password → consent → code → tokens', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const page = await (await browser.fetch(authorizeUrl())).text();
    const requestId = requestIdOf(page);

    const first = await parse(
      await browser.fetch(
        `/rpc/screen?request_id=${encodeURIComponent(requestId)}`
      )
    );
    expect(kindOf(first)).toBe('identifier');

    // Step transitions are cookies-only: the SPA never sends the session id.
    const identifiedResponse = await browser.fetch(
      '/rpc/identifier',
      jsonBody({ request_id: requestId, email: 'alice@gmail.com' })
    );
    expect(identifiedResponse.headers.get('set-cookie') ?? '').toContain(
      'IDP_SID'
    );
    const identified = await parse(identifiedResponse);
    expect(kindOf(identified)).toBe('password');

    const authed = await submit(browser, 'password', {
      request_id: requestId,
      password: IDP_PASSWORD,
    });
    expect(kindOf(authed)).toBe('consent');

    const done = await submit(browser, 'consent', {
      request_id: requestId,
      decision: 'allow',
    });
    const code = new URL(locationOf(done)).searchParams.get('code') ?? '';
    expect(code.startsWith('4/0A')).toBe(true);

    const tokens = (await (
      await browser.fetch('/token', exchangeBody({ code }))
    ).json()) as Record<string, string>;
    const profile = (await (
      await browser.fetch('/v1/userinfo', {
        headers: { authorization: `Bearer ${tokens['access_token'] ?? ''}` },
      })
    ).json()) as Record<string, unknown>;
    // The RPC path and the form path reach the same store: the code names the
    // account the form would have signed in.
    const alice = await fixture.store.accountByEmail('alice@gmail.com');
    expect(String(profile['sub'])).toBe(alice?.sub);
    expect(profile['email']).toBe('alice@gmail.com');
  });

  test('an expired request answers with the error screen, not a form', async () => {
    const fixture = await createIdpFixture();
    const denied = await submit(fixture.browser(), 'identifier', {
      request_id: 'gone',
      email: 'alice@gmail.com',
    });
    expect(kindOf(denied)).toBe('error');
  });

  test('the create-account step persists into the store', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idp-rpc-'));
    const file = join(dir, 'idp.sqlite');
    try {
      const first = SqlClientImplBunSqlite.open(file);
      await first.connect();
      const a = await openIdpFixture({ sqlClient: first });
      const browser = a.browser();
      const page = await (await browser.fetch(authorizeUrl())).text();
      const created = await submit(browser, 'create-account', {
        request_id: requestIdOf(page),
        name: 'Nina Fort',
        email: 'nina@example.com',
      });
      expect(kindOf(created)).toBe('consent');

      const admin = (await (
        await browser.fetch(`${IDP_ADMIN_PREFIX}/state`)
      ).json()) as { readonly accounts: readonly { readonly email: string }[] };
      expect(admin.accounts.map((account) => account.email)).toContain(
        'nina@example.com'
      );
      await a.close();

      const second = SqlClientImplBunSqlite.open(file);
      await second.connect();
      const b = await openIdpFixture({
        sqlClient: second,
        createId: createTestIdStream('b-'),
      });
      try {
        const account = await b.store.accountByEmail('nina@example.com');
        expect(account?.name).toBe('Nina Fort');
      } finally {
        await b.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
