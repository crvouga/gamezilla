/**
 * Email sign-in as a deployment configures it: a host that names where its
 * sign-in links go offers `email` beside its social providers and answers
 * the email routes; one that names nothing offers and answers neither.
 */

import { describe, expect, test } from 'bun:test';
import { createEmailInboxEmulator } from '@pkgs/auth-inhouse-server-ts/email-inbox-emulator';
import { INHOUSE_AUTH_SECRET } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-config';
import {
  INHOUSE_AUTH_PROVIDER,
  inhouseAuthProviderWith,
} from '@pkgs/auth-inhouse-server-ts/inhouse-auth-provider';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server-ts/reconcile-idp-sqlite';
import type {
  AuthProviderEnv,
  AuthProviderModule,
} from '@pkgs/auth-root-shared-ts/auth-provider-module';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';

const API = 'https://api.example';
const SECRETS: Readonly<Record<string, string>> = {
  [INHOUSE_AUTH_SECRET.secret]: 'provider-secret-provider-secret-provider',
  [INHOUSE_AUTH_SECRET.googleClientId]: 'provider-client',
  [INHOUSE_AUTH_SECRET.googleClientSecret]: 'provider-client-secret',
  [INHOUSE_AUTH_SECRET.googleIdpOrigin]: 'https://idp.example',
};

async function build(module: AuthProviderModule) {
  const db = SqlClientImplMockingbirdSqlite.open({ seed: 7 });
  await reconcileIdpSqlite(db);
  const { clock } = createHarnessClock({ startMs: Date.UTC(2026, 0, 1) });
  const env: AuthProviderEnv = {
    readSecret: (name) => Promise.resolve(SECRETS[name] ?? null),
    isProduction: false,
    apiOrigin: API,
    apiPathPrefix: '/api',
    clientOrigins: ['https://app.example'],
    clientSchemes: ['myapp'],
    clock,
    createId: createHarnessIds(7).createId,
    http: { fetch: () => Promise.reject(new Error('Unexpected egress')) },
    getSql: () => db,
    onUserChanged: () => Promise.resolve(),
  };
  const provider = await module.create(env);
  const call = async (path: string, body?: unknown): Promise<Response> => {
    const handler = provider.handler;
    if (handler === undefined) throw new Error('Expected hosted endpoints');
    return await handler.fetch(
      new Request(`${API}/api/auth/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    );
  };
  return { db, env, provider, call };
}

describe('email sign-in as a deployment configures it', () => {
  test('a host that names where links go offers email and mails them', async () => {
    const inbox = createEmailInboxEmulator();
    const seen: AuthProviderEnv[] = [];
    const host = await build(
      inhouseAuthProviderWith({
        emailLinks: (env) => {
          seen.push(env);
          return inbox.delivery;
        },
      })
    );
    try {
      expect(seen).toEqual([host.env]);
      expect(host.provider.signInMethods).toEqual(['google', 'email']);
      expect(await (await host.call('providers')).json()).toEqual({
        providers: ['google'],
        emailLinks: true,
      });
      const asked = await host.call('email/request', {
        email: 'alice@example.com',
        callbackUrl: 'https://app.example/sso-callback',
      });
      expect(asked.status).toBe(202);
      const token = inbox.latest('alice@example.com')?.token;
      const opened = await host.call('email/confirm', { token });
      expect(opened.status).toBe(200);
      const session = (await opened.json()) as { token: string };
      const verified = await host.provider.server.verifySessionToken(
        session.token
      );
      expect(verified?.email).toBe('alice@example.com');
      const user = await host.provider.server.getUser(
        verified?.externalUserId ?? ''
      );
      expect(user?.identities).toMatchObject([
        {
          provider: 'email',
          providerUserId: 'alice@example.com',
          emailVerified: true,
        },
      ]);
    } finally {
      await host.db.disconnect();
    }
  });

  test('a host that names nothing offers no email sign-in', async () => {
    const host = await build(INHOUSE_AUTH_PROVIDER);
    try {
      expect(host.provider.signInMethods).toEqual(['google']);
      expect(await (await host.call('providers')).json()).toEqual({
        providers: ['google'],
        emailLinks: false,
      });
      expect(
        (await host.call('email/request', { email: 'alice@example.com' }))
          .status
      ).toBe(404);
      expect(
        (await host.call('email/confirm', { token: 'anything' })).status
      ).toBe(404);
    } finally {
      await host.db.disconnect();
    }
  });
});
