/**
 * The one example app every auth test, model and spec drives: a relying
 * party that mounts the in-house auth app under `/api` (as the product's API
 * worker does), signs people in with Google, with Apple and with links it
 * mails, and is registered at each provider as its one client. A test that
 * needs a variation configures this app (its providers' faults, directories,
 * keys, whether it has a way to send mail); it never declares another client.
 */

import type { AppleProviderConfig } from '@pkgs/auth-inhouse-server-ts/apple-oauth';
import { createAuthApp } from '@pkgs/auth-inhouse-server-ts/create-auth-app';
import type { EmailLinkDelivery } from '@pkgs/auth-inhouse-server-ts/email-link-delivery';
import {
  appleEndpointsFor,
  googleEndpointsFor,
} from '@pkgs/auth-inhouse-server-ts/inhouse-auth-config';
import type { Ports } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { Hono } from 'hono';

/** What the providers' consent screens call the example app. */
export const EXAMPLE_APP_NAME = 'Auth Example App';

export const AUTH_SYSTEM_BASE_URL = 'http://auth.test';
/** Where the auth app is mounted, as in production (`/api/auth/*`). */
export const AUTH_SYSTEM_PATH_PREFIX = '/api';
export const AUTH_SYSTEM_SECRET = 'auth-system-secret-0123456789abcdef';
export const AUTH_SYSTEM_CALLBACK_URL = 'myapp://sso-callback';
export const AUTH_SYSTEM_TRUSTED_ORIGINS: readonly string[] = [
  AUTH_SYSTEM_BASE_URL,
  'myapp://',
  'http://localhost:5173',
  'http://callback.test',
];
export const EXAMPLE_APP_API = `${AUTH_SYSTEM_BASE_URL}${AUTH_SYSTEM_PATH_PREFIX}`;

/** The example app mails sign-in links to every address but this domain's. */
export const UNSERVED_EMAIL_DOMAIN = 'unserved.test';

export function exampleAppServes(email: string): boolean {
  return !email.endsWith(`@${UNSERVED_EMAIL_DOMAIN}`);
}

export const GOOGLE_ORIGIN = 'http://google.idp.test';
export const APPLE_ORIGIN = 'http://apple.idp.test';
export const GOOGLE_CLIENT_ID = 'auth-harness.apps.googleusercontent.com';
export const GOOGLE_CLIENT_SECRET = 'auth-harness-client-secret';
export const APPLE_CLIENT_ID = 'test.auth-harness.signin';
export const APPLE_TEAM_ID = 'TEAMSIM001';
export const APPLE_KEY_ID = 'KEYSIM0001';

/** The P-256 pair the example app signs its Apple client secret with. */
export type AppleClientKeys = {
  readonly privateJwk: JsonWebKey;
  readonly publicJwk: JsonWebKey;
};

async function createAppleClientKeys(): Promise<AppleClientKeys> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const {
    key_ops: _ops,
    ext: _ext,
    ...privateJwk
  } = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const { d: _d, ...publicJwk } = privateJwk;
  return { privateJwk, publicJwk };
}

/**
 * The example app's ES256 Sign in with Apple key: generated once per
 * process and shared by every run (no scenario is about it).
 */
let appleKeys: Promise<AppleClientKeys> | null = null;

export function sharedAppleKeys(): Promise<AppleClientKeys> {
  appleKeys ??= createAppleClientKeys();
  return appleKeys;
}

export async function appleRelyingPartyConfig(): Promise<AppleProviderConfig> {
  const keys = await sharedAppleKeys();
  return {
    clientId: APPLE_CLIENT_ID,
    teamId: APPLE_TEAM_ID,
    keyId: APPLE_KEY_ID,
    privateJwk: { ...keys.privateJwk },
    endpoints: appleEndpointsFor(APPLE_ORIGIN),
    issuer: APPLE_ORIGIN,
  };
}

/**
 * The example app: the auth app mounted under `/api`. `emailLinks` is where
 * its sign-in links go; `null` builds it with no way to send mail.
 */
export async function buildExampleApp(
  sql: SqlClient,
  ports: Ports,
  egress: HttpClient,
  emailLinks: EmailLinkDelivery | null
): Promise<Hono> {
  const authApp = createAuthApp({
    getSql: () => sql,
    clock: ports.clock,
    createId: ports.createId,
    http: egress,
    secret: AUTH_SYSTEM_SECRET,
    baseURL: AUTH_SYSTEM_BASE_URL,
    publicPathPrefix: AUTH_SYSTEM_PATH_PREFIX,
    trustedOrigins: AUTH_SYSTEM_TRUSTED_ORIGINS,
    providers: {
      google: {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        endpoints: googleEndpointsFor(GOOGLE_ORIGIN),
      },
      apple: await appleRelyingPartyConfig(),
    },
    ...(emailLinks === null ? {} : { emailLinks }),
  });
  return new Hono().route(AUTH_SYSTEM_PATH_PREFIX, authApp);
}
