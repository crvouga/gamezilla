/**
 * The identity-provider nodes of the auth simulation: one Google-flavored
 * and one Apple-flavored mock, each on its own origin with its own SQLite
 * directory, sessions, grants and faults. The auth app reaches them only
 * over HTTP, and the Apple node reaches back only over HTTP (its
 * server-to-server notifications), so the production code paths are the
 * ones exercised.
 */

import type { AppleProviderConfig } from '@pkgs/auth/server';
import type { HttpClient } from '@pkgs/http-client';
import {
  type AppleClientKeys,
  createAppleClientKeys,
  createIdpSigningKeys,
  createIdpSimApp,
  type IdpSigningKeys,
  type IdpSim,
  IdpStore,
} from '@pkgs/idp-sim/server';
import {
  appleEndpoints,
  type IdpAccountDraft,
  type IdpProviderKind,
} from '@pkgs/idp-sim/shared';
import type { Ports } from '@pkgs/sim';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';

import { AUTH_SYSTEM_BASE_URL, AUTH_SYSTEM_PATH_PREFIX } from './types';

const API = `${AUTH_SYSTEM_BASE_URL}${AUTH_SYSTEM_PATH_PREFIX}`;

export const GOOGLE_ORIGIN = 'http://google.idp.test';
export const APPLE_ORIGIN = 'http://apple.idp.test';
export const IDP_ORIGINS: Readonly<Record<IdpProviderKind, string>> = {
  google: GOOGLE_ORIGIN,
  apple: APPLE_ORIGIN,
};
export const GOOGLE_CLIENT_ID = 'auth-sim.apps.googleusercontent.com';
export const GOOGLE_CLIENT_SECRET = 'auth-sim-client-secret';
export const APPLE_CLIENT_ID = 'test.auth-sim.signin';
export const APPLE_TEAM_ID = 'TEAMSIM001';
export const APPLE_KEY_ID = 'KEYSIM0001';

/**
 * Who exists where. `chris`, `wendy`, `uma` and `vic` hold both a Google and
 * an Apple account — the cases linking by address exists for. Google vouches
 * for chris's and wendy's (Workspace) addresses, so those link on their own;
 * it does not vouch for uma's or vic's, so those must be proven.
 */
export const GOOGLE_DIRECTORY: readonly IdpAccountDraft[] = [
  { handle: 'alice' },
  { handle: 'bob' },
  { handle: 'chris' },
  { handle: 'uma', email: 'uma@unverified.test', emailVerified: false },
  { handle: 'vic', email: 'vic@unverified.test', emailVerified: false },
  { handle: 'wendy', email: 'wendy@workspace.test', hd: 'workspace.test' },
];

export const APPLE_DIRECTORY: readonly IdpAccountDraft[] = [
  { handle: 'alice' },
  { handle: 'chris', email: 'chris@gmail.com' },
  { handle: 'uma', email: 'uma@unverified.test' },
  { handle: 'vic', email: 'vic@unverified.test' },
  { handle: 'wendy', email: 'wendy@workspace.test' },
  { handle: 'dan', realUserStatus: 2 },
];

export const DIRECTORIES: Readonly<
  Record<IdpProviderKind, readonly IdpAccountDraft[]>
> = { google: GOOGLE_DIRECTORY, apple: APPLE_DIRECTORY };

/**
 * Key generation is the costliest part of a boot and no scenario is about
 * it: one RS256 pair per provider flavor and one ES256 relying-party key per
 * process, shared by every run.
 */
let signingKeys: Promise<IdpSigningKeys> | null = null;
let appleKeys: Promise<AppleClientKeys> | null = null;

function sharedSigningKeys(): Promise<IdpSigningKeys> {
  signingKeys ??= createIdpSigningKeys();
  return signingKeys;
}

function sharedAppleKeys(): Promise<AppleClientKeys> {
  appleKeys ??= createAppleClientKeys();
  return appleKeys;
}

export async function appleRelyingPartyConfig(): Promise<AppleProviderConfig> {
  const keys = await sharedAppleKeys();
  return {
    clientId: APPLE_CLIENT_ID,
    teamId: APPLE_TEAM_ID,
    keyId: APPLE_KEY_ID,
    privateJwk: keys.privateJwk,
    endpoints: appleEndpoints(APPLE_ORIGIN),
    issuer: APPLE_ORIGIN,
  };
}

async function openStore(
  ports: Ports,
  provider: IdpProviderKind
): Promise<IdpStore> {
  const seed =
    Math.floor(ports.rng.fork(`idp-sql-${provider}`).next() * 0xffffffff) || 1;
  return await IdpStore.open({
    provider,
    sqlClient: SqlClientImplSqliteMem.open({ seed }),
    clock: ports.clock,
    createId: ports.createId,
    createKeys: sharedSigningKeys,
  });
}

export async function startIdpNodes(args: {
  readonly ports: Ports;
  /** The provider's egress: Apple's notifications go back to the auth app. */
  readonly egress: HttpClient;
}): Promise<Record<IdpProviderKind, IdpSim>> {
  const apple = await sharedAppleKeys();
  const google = await createIdpSimApp({
    store: await openStore(args.ports, 'google'),
    issuer: GOOGLE_ORIGIN,
    clients: [
      {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        redirectUris: [`${API}/auth/callback/google`],
        appName: 'Auth Simulation',
      },
    ],
    accounts: GOOGLE_DIRECTORY,
  });
  const appleIdp = await createIdpSimApp({
    store: await openStore(args.ports, 'apple'),
    issuer: APPLE_ORIGIN,
    http: args.egress,
    clients: [
      {
        clientId: APPLE_CLIENT_ID,
        clientSecret: '',
        redirectUris: [`${API}/auth/callback/apple`],
        appName: 'Auth Simulation',
        apple: {
          teamId: APPLE_TEAM_ID,
          keyId: APPLE_KEY_ID,
          publicJwk: { ...apple.publicJwk },
          notificationUrl: `${API}/auth/apple/notifications`,
        },
      },
    ],
    accounts: APPLE_DIRECTORY,
  });
  return { google, apple: appleIdp };
}

/** Which node owns `url`, or `null` for the auth app itself. */
export function idpForUrl(
  idps: Readonly<Record<IdpProviderKind, IdpSim>>,
  url: string
): IdpSim | null {
  if (url.startsWith(GOOGLE_ORIGIN)) return idps.google;
  if (url.startsWith(APPLE_ORIGIN)) return idps.apple;
  return null;
}
