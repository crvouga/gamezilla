import { describe, expect, test } from 'bun:test';
import { createInProcessOpenAuthSession } from '@pkgs/auth-inhouse-client-ts/in-process-open-auth-session';
import { createAuthApp } from '@pkgs/auth-inhouse-server-ts/create-auth-app';
import { googleEndpointsFor } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-config';
import type { OauthCallbackRelay } from '@pkgs/auth-inhouse-server-ts/oauth-callback-relay';
import {
  createOauthCallbackRelayApp,
  parseRelayTargets,
} from '@pkgs/auth-inhouse-server-ts/oauth-callback-relay';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server-ts/reconcile-idp-sqlite';
import { oauthClientCallbackUrl } from '@pkgs/auth-inhouse-shared-ts/oauth-client-callback-url';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { Hono } from 'hono';
import { ALICE_EMAIL, simulatedGoogle } from './simulated-google';

/**
 * Two deployments of the IdP share one provider registration: the provider
 * knows only the relay's callback. A sign-in launched on either deployment
 * must finish there, through the relay.
 */

const RELAY_ORIGIN = 'https://auth.example.test';
const PRD_API = 'https://api.example.test';
const DEV_API = 'https://api-dev.app.example';
const DEV_WEB = 'https://www-dev.app.example';
const DEV_APEX = 'https://dev.app.example';
const IDP_URL = 'https://accounts.idp.test';
const PREFIX = '/api';
const SECRET = 'auth-system-secret-0123456789abcdef';
const CLIENT_ID = 'cid.apps.googleusercontent.com';
const CLIENT_SECRET = 'csecret';
const START_MS = 1_767_225_600_000;
const ACCOUNT = { email: ALICE_EMAIL };
const REGISTERED_CALLBACK = `${RELAY_ORIGIN}${PREFIX}/auth/callback/google`;

type Wire = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type Deployment = {
  readonly origin: string;
  readonly relay: OauthCallbackRelay;
};

const PRD: Deployment = {
  origin: PRD_API,
  relay: { callbackOrigin: RELAY_ORIGIN, stateTag: 'prd' },
};
const DEV: Deployment = {
  origin: DEV_API,
  relay: { callbackOrigin: RELAY_ORIGIN, stateTag: 'dev' },
};

function hrefOf(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

async function bootDeployment(
  deployment: Deployment,
  wire: Wire,
  seed: number
): Promise<Hono> {
  const sql = SqlClientImplMockingbirdSqlite.open({ seed });
  await reconcileIdpSqlite(sql);
  let nextId = 0;
  const { clock } = createHarnessClock({ startMs: START_MS });
  const app = new Hono();
  app.route(
    PREFIX,
    createAuthApp({
      getSql: () => sql,
      clock,
      createId: () => `id-${seed}-${(nextId += 1)}`,
      http: { fetch: (input, init) => wire(input, init) },
      secret: SECRET,
      baseURL: deployment.origin,
      publicPathPrefix: PREFIX,
      trustedOrigins: [deployment.origin, DEV_WEB, DEV_APEX],
      providers: {
        google: {
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          endpoints: googleEndpointsFor(IDP_URL),
        },
      },
      callbackRelay: deployment.relay,
    })
  );
  return app;
}

async function bootFleet(): Promise<{ readonly wire: Wire }> {
  const { clock } = createHarnessClock({ startMs: START_MS });
  const google = simulatedGoogle({
    origin: IDP_URL,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    // The one registration every deployment shares.
    redirectUris: [REGISTERED_CALLBACK],
    clock,
  });
  const hosts = new Map<string, Hono>();
  const wire: Wire = async (input, init) => {
    const href = hrefOf(input);
    const request =
      input instanceof Request && init === undefined
        ? input
        : new Request(href, init);
    if (href.startsWith(IDP_URL)) return await google(request);
    const host = hosts.get(new URL(href).origin);
    if (host === undefined) throw new Error(`no route to ${href}`);
    return await host.request(request);
  };
  const relay = new Hono();
  relay.route(
    '/',
    createOauthCallbackRelayApp({
      forwardTo: parseRelayTargets(
        JSON.stringify({ prd: PRD_API, dev: DEV_API }),
        'OAUTH_RELAY_TARGETS'
      ),
      publicPathPrefix: PREFIX,
    })
  );
  hosts.set(RELAY_ORIGIN, relay);
  hosts.set(PRD_API, await bootDeployment(PRD, wire, 1));
  hosts.set(DEV_API, await bootDeployment(DEV, wire, 2));
  return { wire };
}

function launchUrl(api: string, callbackUrl: string): string {
  return `${api}${PREFIX}/auth/oauth/launch?provider=google&callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

describe('oauth callback relay (black-box)', () => {
  // regression: dev-apex-oauth-callback-rejected
  test.each([DEV_WEB, DEV_APEX])(
    'a deployment signs in from %s through the one registered callback',
    async (webOrigin) => {
      const { wire } = await bootFleet();
      const callbackUrl = oauthClientCallbackUrl(webOrigin, 'myapp');
      const launch = await wire(launchUrl(DEV_API, callbackUrl), {
        redirect: 'manual',
      });
      expect(launch.status).toBe(302);
      const authorize = new URL(launch.headers.get('location') ?? '');
      expect(authorize.searchParams.get('redirect_uri')).toBe(
        REGISTERED_CALLBACK
      );
      expect(authorize.searchParams.get('state')?.startsWith('dev.')).toBe(
        true
      );

      const result = await createInProcessOpenAuthSession({
        fetch: wire,
        account: ACCOUNT,
      })(launchUrl(DEV_API, callbackUrl), callbackUrl);
      expect(result.type).toBe('success');
      const appUrl = result.type === 'success' ? (result.url ?? '') : '';
      const code = new URL(appUrl).searchParams.get('code') ?? '';
      expect(code.length).toBeGreaterThan(0);

      // The exchange code belongs to the launching deployment.
      const session = await wire(`${DEV_API}${PREFIX}/auth/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      expect(session.ok).toBe(true);
    }
  );

  test('the relay forwards a tagged callback verbatim', async () => {
    const { wire } = await bootFleet();
    const res = await wire(
      `${REGISTERED_CALLBACK}?code=abc&state=dev.s1&scope=openid`,
      { redirect: 'manual' }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${DEV_API}${PREFIX}/auth/callback/google?code=abc&state=dev.s1&scope=openid`
    );
  });

  test('a form_post callback is forwarded as a POST', async () => {
    const { wire } = await bootFleet();
    const res = await wire(REGISTERED_CALLBACK, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'code=abc&state=dev.s1',
      redirect: 'manual',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      `${DEV_API}${PREFIX}/auth/callback/google`
    );
  });

  test('an unknown tag is never forwarded', async () => {
    const { wire } = await bootFleet();
    const res = await wire(`${REGISTERED_CALLBACK}?code=abc&state=evil.s1`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });

  test('an untagged state is never forwarded', async () => {
    const { wire } = await bootFleet();
    const res = await wire(`${REGISTERED_CALLBACK}?code=abc&state=s1`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });

  test('every deployment, production included, returns through the relay', async () => {
    const { wire } = await bootFleet();
    const res = await wire(`${REGISTERED_CALLBACK}?code=abc&state=prd.s1`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${PRD_API}${PREFIX}/auth/callback/google?code=abc&state=prd.s1`
    );
  });

  test('the relay refuses a target map that is not tag → http(s) origin', () => {
    expect(() => parseRelayTargets('[]', 'T')).toThrow(/JSON object/);
    expect(() => parseRelayTargets('{"Bad":"https://x.test"}', 'T')).toThrow(
      /bad entry/
    );
    expect(() => parseRelayTargets('{"dev":"ftp://x.test"}', 'T')).toThrow(
      /http\(s\)/
    );
  });
});
