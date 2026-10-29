// @io-wall-ok — tools composition root.

/**
 * The stack's two simulated identity providers — Google and Apple
 * (`@crvouga/mockingbird-service-oauth` on each one's wire profile), each on
 * its own port with its own state — and the API bindings that point the
 * Worker at them.
 */

import type { Account } from '@crvouga/mockingbird-service-oauth';
import { createServer } from '@crvouga/mockingbird-service-oauth/server';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import {
  LOCAL_ADMIN_ACCOUNTS,
  type LocalAdminIdentity,
  localAdminIdentities,
} from './local-admin-accounts';
import { mockingbirdSqliteFile } from './mockingbird-sqlite';
import type { IdpStateMode } from './stack-options';

const GOOGLE_CLIENT_ID = 'localhost-stack.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'localhost-stack-google-secret';
const APPLE_CLIENT_ID = 'dev.localhost-stack.signin';
const APPLE_TEAM_ID = 'STACKTEAM1';
const APPLE_KEY_ID = 'STACKKEY01';

/** Who a fresh stack's providers know, so the chooser has a list worth reading. */
const GOOGLE_ACCOUNTS = ['alice', 'bob', 'chris', 'dan', 'ed', 'fred'].map(
  (handle) => `${handle}@gmail.com`
);
const APPLE_ACCOUNTS = [
  'alice@icloud.com',
  'bob@icloud.com',
  // The same person as Google's `chris`: sign in with both to link.
  'chris@gmail.com',
  'dan@icloud.com',
];

function accountAt(email: string): Account {
  const handle = email.slice(0, email.indexOf('@'));
  const givenName = handle.charAt(0).toUpperCase() + handle.slice(1);
  return {
    id: email.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    email,
    name: `${givenName} Tester`,
    givenName,
    familyName: 'Tester',
  };
}

export type IdpState = {
  readonly mode: IdpStateMode;
  readonly path: string | null;
};

type IdpServer = Awaited<ReturnType<typeof createServer>>;

export type StackIdps = {
  readonly google: IdpServer;
  readonly apple: IdpServer;
  readonly adminIdentities: readonly LocalAdminIdentity[];
  /** Worker bindings for both providers. */
  readonly apiEnv: Readonly<Record<string, string>>;
};

/** Apple keeps its own file beside Google's: `idp.sqlite` → `idp.apple.sqlite`. */
function appleState(state: IdpState): IdpState {
  if (state.path === null) return state;
  const path = state.path.endsWith('.sqlite')
    ? `${state.path.slice(0, -'.sqlite'.length)}.apple.sqlite`
    : `${state.path}.apple`;
  return { mode: state.mode, path };
}

function storageOf(state: IdpState) {
  return state.path === null
    ? {}
    : { sqlite: mockingbirdSqliteFile(state.path) };
}

/** The P-256 pair the API signs its Apple client secret with. */
export async function createAppleClientKeys(): Promise<{
  readonly privateJwk: JsonWebKey;
  readonly publicJwk: JsonWebKey;
}> {
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
 * Boot both providers. The Apple one holds the public half of a key minted
 * here; the API nodes get the private half to sign their client secret with,
 * exactly as a developer's downloaded `.p8` key splits between Apple and them.
 */
export async function startStackIdps(args: {
  readonly apiOrigin: string;
  readonly ports: { readonly google: number; readonly apple: number };
  readonly state: IdpState;
}): Promise<StackIdps> {
  const keys = await createAppleClientKeys();
  const callback = (provider: 'google' | 'apple'): string =>
    `${args.apiOrigin}/api/auth/callback/${provider}`;
  const origin = (port: number): string => `http://127.0.0.1:${String(port)}`;
  const started = await Promise.allSettled([
    createServer({
      provider: 'google',
      port: args.ports.google,
      issuer: origin(args.ports.google),
      ...storageOf(args.state),
      accounts: [...GOOGLE_ACCOUNTS.map(accountAt), ...LOCAL_ADMIN_ACCOUNTS],
      clients: [
        {
          id: GOOGLE_CLIENT_ID,
          name: PRODUCT_NAME,
          secret: GOOGLE_CLIENT_SECRET,
          redirectUris: [callback('google')],
        },
      ],
    }),
    createServer({
      provider: 'apple',
      port: args.ports.apple,
      issuer: origin(args.ports.apple),
      ...storageOf(appleState(args.state)),
      accounts: [...APPLE_ACCOUNTS.map(accountAt), ...LOCAL_ADMIN_ACCOUNTS],
      behavior: { session: { reuseLastAccount: false } },
      clients: [
        {
          id: APPLE_CLIENT_ID,
          name: PRODUCT_NAME,
          redirectUris: [callback('apple')],
          apple: {
            teamId: APPLE_TEAM_ID,
            keyId: APPLE_KEY_ID,
            publicKey: keys.publicJwk,
          },
        },
      ],
    }),
  ]);
  const [google, apple] = started;
  if (google.status === 'rejected' || apple.status === 'rejected') {
    for (const result of started) {
      if (result.status === 'fulfilled') await result.value.close();
    }
    const failed = google.status === 'rejected' ? google : apple;
    throw failed.status === 'rejected' ? failed.reason : new Error('idp boot');
  }
  return {
    google: google.value,
    apple: apple.value,
    adminIdentities: [
      ...(await localAdminIdentities(
        'google',
        GOOGLE_CLIENT_ID,
        google.value.runtime
      )),
      ...(await localAdminIdentities(
        'apple',
        APPLE_CLIENT_ID,
        apple.value.runtime
      )),
    ],
    apiEnv: {
      WEB_CLIENT_GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
      WEB_CLIENT_GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
      GOOGLE_IDP_ORIGIN: google.value.url,
      APPLE_IDP_ORIGIN: apple.value.url,
      APPLE_CLIENT_ID,
      APPLE_TEAM_ID,
      APPLE_KEY_ID,
      APPLE_PRIVATE_JWK: JSON.stringify(keys.privateJwk),
    },
  };
}
