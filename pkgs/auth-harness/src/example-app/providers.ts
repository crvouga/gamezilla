/**
 * The example app's providers: one Google-flavored and one Apple-flavored
 * mock, each on its own origin with its own SQLite directory, sessions,
 * grants and faults, with the example app registered as their one client.
 * The example app reaches them only over HTTP, and the Apple node reaches
 * back only over HTTP (its server-to-server notifications), so the
 * production code paths are the ones exercised.
 */

import type { Ports } from '@pkgs/harness';
import type { HttpClient } from '@pkgs/http-client';
import {
  createIdpMockApp,
  createIdpSigningKeys,
  type IdpMock,
  type IdpSigningKeys,
  IdpStore,
} from '@pkgs/idp-mock/server';
import type { IdpAccountDraft, IdpProviderKind } from '@pkgs/idp-mock/shared';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';

import {
  APPLE_CLIENT_ID,
  APPLE_KEY_ID,
  APPLE_ORIGIN,
  APPLE_TEAM_ID,
  EXAMPLE_APP_API,
  EXAMPLE_APP_NAME,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_ORIGIN,
  sharedAppleKeys,
} from './relying-party';

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
 * it: one RS256 pair per provider flavor per process, shared by every run.
 */
let signingKeys: Promise<IdpSigningKeys> | null = null;

function sharedSigningKeys(): Promise<IdpSigningKeys> {
  signingKeys ??= createIdpSigningKeys();
  return signingKeys;
}

async function openStore(
  ports: Ports,
  provider: IdpProviderKind
): Promise<IdpStore> {
  const seed =
    Math.floor(ports.rng.fork(`idp-sql-${provider}`).next() * 0xffffffff) || 1;
  return await IdpStore.open({
    provider,
    sqlClient: SqlClientImplMockingbirdSqlite.open({ seed }),
    clock: ports.clock,
    createId: ports.createId,
    createKeys: sharedSigningKeys,
  });
}

export async function startIdpNodes(args: {
  readonly ports: Ports;
  /** The provider's egress: Apple's notifications go back to the auth app. */
  readonly egress: HttpClient;
}): Promise<Record<IdpProviderKind, IdpMock>> {
  const apple = await sharedAppleKeys();
  const google = await createIdpMockApp({
    store: await openStore(args.ports, 'google'),
    issuer: GOOGLE_ORIGIN,
    clients: [
      {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        redirectUris: [`${EXAMPLE_APP_API}/auth/callback/google`],
        appName: EXAMPLE_APP_NAME,
      },
    ],
    accounts: GOOGLE_DIRECTORY,
  });
  const appleIdp = await createIdpMockApp({
    store: await openStore(args.ports, 'apple'),
    issuer: APPLE_ORIGIN,
    http: args.egress,
    clients: [
      {
        clientId: APPLE_CLIENT_ID,
        clientSecret: '',
        redirectUris: [`${EXAMPLE_APP_API}/auth/callback/apple`],
        appName: EXAMPLE_APP_NAME,
        apple: {
          teamId: APPLE_TEAM_ID,
          keyId: APPLE_KEY_ID,
          publicJwk: { ...apple.publicJwk },
          notificationUrl: `${EXAMPLE_APP_API}/auth/apple/notifications`,
        },
      },
    ],
    accounts: APPLE_DIRECTORY,
  });
  return { google, apple: appleIdp };
}

/** Which node owns `url`, or `null` for the auth app itself. */
export function idpForUrl(
  idps: Readonly<Record<IdpProviderKind, IdpMock>>,
  url: string
): IdpMock | null {
  if (url.startsWith(GOOGLE_ORIGIN)) return idps.google;
  if (url.startsWith(APPLE_ORIGIN)) return idps.apple;
  return null;
}
