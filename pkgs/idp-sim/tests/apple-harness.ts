/**
 * Apple-flavored fixture: a Services ID with a real ES256 key pair, the
 * relying party's side of the client-secret JWT, and helpers that walk the
 * sign-in to its `form_post` hand-off.
 */

import {
  APPLE_CLIENT_SECRET_AUDIENCE,
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_PASSWORD,
  IDP_TEST_IDS,
  type IdpClient,
} from '@pkgs/idp-sim/shared';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

import {
  createIdpFixture,
  formBody,
  type IdpBrowser,
  type IdpFixture,
  requestIdOf,
  submitIdentifier,
  submitPassword,
} from './harness';

export const APPLE_REDIRECT_URI = 'https://app.test/api/auth/callback/apple';
export const APPLE_NOTIFICATION_URL = 'https://app.test/api/auth/apple/events';
export const APPLE_TEAM_ID = 'TEAM123456';
export const APPLE_KEY_ID = 'KEY1234567';
export const APPLE_CLIENT_ID = 'test.app.signin';

export type AppleRp = {
  readonly client: IdpClient;
  /** Mint a `client_secret` the way the relying party does. */
  secret(overrides?: {
    readonly iss?: string;
    readonly sub?: string;
    readonly aud?: string;
    readonly kid?: string;
    readonly lifetimeS?: number;
    readonly iatMs?: number;
  }): Promise<string>;
};

export async function createAppleRp(nowMs: () => number): Promise<AppleRp> {
  const { privateKey, publicKey } = await generateKeyPair('ES256', {
    extractable: true,
  });
  const client: IdpClient = {
    clientId: APPLE_CLIENT_ID,
    clientSecret: '',
    redirectUris: [APPLE_REDIRECT_URI],
    appName: 'Test App',
    apple: {
      teamId: APPLE_TEAM_ID,
      keyId: APPLE_KEY_ID,
      publicJwk: { ...(await exportJWK(publicKey)) },
      notificationUrl: APPLE_NOTIFICATION_URL,
    },
  };
  return {
    client,
    async secret(overrides = {}) {
      const iat = Math.floor((overrides.iatMs ?? nowMs()) / 1000);
      return await new SignJWT({})
        .setProtectedHeader({
          alg: 'ES256',
          kid: overrides.kid ?? APPLE_KEY_ID,
        })
        .setIssuer(overrides.iss ?? APPLE_TEAM_ID)
        .setSubject(overrides.sub ?? APPLE_CLIENT_ID)
        .setAudience(overrides.aud ?? APPLE_CLIENT_SECRET_AUDIENCE)
        .setIssuedAt(iat)
        .setExpirationTime(iat + (overrides.lifetimeS ?? 3600))
        .sign(privateKey);
    },
  };
}

export type AppleFixture = IdpFixture & {
  readonly rp: AppleRp;
  /** Notifications the provider POSTed to the relying party. */
  readonly delivered: { readonly url: string; readonly body: string }[];
};

export async function createAppleFixture(): Promise<AppleFixture> {
  const delivered: { url: string; body: string }[] = [];
  let clockRef: () => number = () => 0;
  const rp = await createAppleRp(() => clockRef());
  const fixture = await createIdpFixture({
    provider: 'apple',
    clients: [rp.client],
    http: {
      async fetch(input, init) {
        delivered.push({ url: String(input), body: String(init?.body ?? '') });
        return new Response(null, { status: 200 });
      },
    },
  });
  clockRef = () => fixture.clock.now();
  return { ...fixture, rp, delivered };
}

export function appleAuthorizeUrl(
  overrides: Record<string, string> = {}
): string {
  const params = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    redirect_uri: APPLE_REDIRECT_URI,
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email',
    state: 'state-apple',
    nonce: 'nonce-apple',
    ...overrides,
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === '') params.delete(key);
  }
  return `/auth/authorize?${params.toString()}`;
}

/** Sign in as `email` and stop on whatever screen follows the password. */
export async function appleSignIn(
  browser: IdpBrowser,
  url: string,
  email: string
): Promise<string> {
  const entry = await (await browser.fetch(url)).text();
  if (!entry.includes(IDP_TEST_IDS.identifierPage)) return entry;
  const identified = await submitIdentifier(browser, entry, email);
  const authed = await submitPassword(
    browser,
    await identified.text(),
    IDP_PASSWORD
  );
  return await authed.text();
}

export async function appleConsent(
  browser: IdpBrowser,
  consentHtml: string,
  fields: Record<string, string> = {}
): Promise<Response> {
  return await browser.fetch(
    IDP_AUTHORIZE_SUBMIT_PATH,
    formBody({
      request_id: requestIdOf(consentHtml),
      step: 'consent',
      decision: 'allow',
      ...fields,
    })
  );
}

/** The hidden fields of the `form_post` hand-off document. */
export function formPostFields(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const name = /name="([^"]*)"/.exec(match[0])?.[1];
    const value = /value="([^"]*)"/.exec(match[0])?.[1] ?? '';
    if (name !== undefined) {
      out[name] = value.replaceAll('&quot;', '"').replaceAll('&amp;', '&');
    }
  }
  return out;
}

export function formPostAction(html: string): string {
  return /<form[^>]*action="([^"]*)"/.exec(html)?.[1] ?? '';
}

export async function appleExchange(
  fixture: AppleFixture,
  fields: Record<string, string>
): Promise<Response> {
  return await fixture.browser().fetch(
    '/auth/token',
    formBody({
      client_id: APPLE_CLIENT_ID,
      client_secret: await fixture.rp.secret(),
      grant_type: 'authorization_code',
      redirect_uri: APPLE_REDIRECT_URI,
      ...fields,
    })
  );
}
