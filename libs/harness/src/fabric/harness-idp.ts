/**
 * The identity-provider nodes.
 *
 * Production signs in through Google, and non-production also through Sign
 * in with Apple, so the simulation runs one whole simulated provider of each
 * flavor: its own origin, its own account directory, its own browser
 * sessions and consent grants. Nothing about them is shared with the API —
 * the only way in is each provider's documented OAuth conversation, so the
 * production exchange paths are the ones under test. The Apple node reaches
 * back only through the load balancer, with signed server-to-server
 * notifications, as Apple does.
 *
 * Each sits on `createHarnessNet` like every other node, so it can be
 * partitioned away from a client or from the API and the product has to cope.
 */

import type { ServerHttp } from '@libs/client-app/shell/client-env';
import {
  HARNESS_APPLE_CLIENT_ID,
  HARNESS_APPLE_IDP_URL,
  HARNESS_APPLE_KEY_ID,
  HARNESS_APPLE_TEAM_ID,
  HARNESS_AUTH_SECRET,
  HARNESS_GOOGLE_CLIENT_ID,
  HARNESS_GOOGLE_CLIENT_SECRET,
  HARNESS_IDP_URL,
  HARNESS_SERVER_URL,
} from '@libs/feature/public/harness-constants';
import { INHOUSE_AUTH_SECRET } from '@pkgs/auth-inhouse/server';
import type { Clock } from '@pkgs/clock';
import {
  type AppleClientKeys,
  createAppleClientKeys,
  createIdpMockApp,
  createIdpSigningKeys,
  type IdpMock,
  IdpStore,
} from '@pkgs/idp-mock/server';
import type { IdpProviderKind } from '@pkgs/idp-mock/shared';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import {
  type HarnessBillingProviders,
  harnessBillingFetchFrom,
} from './harness-billing';
import { requestHref } from './harness-http-request';
import type { HarnessNet } from './harness-net';

/** Network node ids, one per provider (partitionable independently). */
export const HARNESS_IDP_ID = 'idp';
export const HARNESS_APPLE_IDP_ID = 'idp-apple';

const NODE_IDS: Readonly<Record<IdpProviderKind, string>> = {
  google: HARNESS_IDP_ID,
  apple: HARNESS_APPLE_IDP_ID,
};

export type HarnessIdps = Readonly<Record<IdpProviderKind, IdpMock>>;

/** Where the API's callbacks land (`createServer` mounts under `/api`). */
export const HARNESS_GOOGLE_REDIRECT_URI = `${HARNESS_SERVER_URL}/api/auth/callback/google`;
export const HARNESS_APPLE_REDIRECT_URI = `${HARNESS_SERVER_URL}/api/auth/callback/apple`;
export const HARNESS_APPLE_NOTIFICATION_URL = `${HARNESS_SERVER_URL}/api/auth/apple/notifications`;

/** Every actor signs in as their own Google account. */
export function harnessIdpEmail(actorId: string): string {
  return `${actorId}@gmail.com`;
}

/**
 * Every actor also holds two Apple Accounts: one registered with the same
 * Gmail address (the same person across providers — linking by address) and
 * one on iCloud (a different address — only an explicit link joins it).
 */
export function harnessAppleEmails(actorId: string): {
  readonly sameAsGoogle: string;
  readonly icloud: string;
} {
  return {
    sameAsGoogle: harnessIdpEmail(actorId),
    icloud: `${actorId}@icloud.com`,
  };
}

/**
 * The in-house IdP's configuration for the harness API: Google and Apple both
 * pointed at their simulated providers, under the same secret and binding
 * names a deployed Worker reads.
 */
export function harnessIdpSecrets(
  keys: AppleClientKeys
): Readonly<Record<string, string>> {
  return {
    [INHOUSE_AUTH_SECRET.secret]: HARNESS_AUTH_SECRET,
    [INHOUSE_AUTH_SECRET.googleClientId]: HARNESS_GOOGLE_CLIENT_ID,
    [INHOUSE_AUTH_SECRET.googleClientSecret]: HARNESS_GOOGLE_CLIENT_SECRET,
    [INHOUSE_AUTH_SECRET.googleIdpOrigin]: HARNESS_IDP_URL,
    [INHOUSE_AUTH_SECRET.appleIdpOrigin]: HARNESS_APPLE_IDP_URL,
    [INHOUSE_AUTH_SECRET.appleClientId]: HARNESS_APPLE_CLIENT_ID,
    [INHOUSE_AUTH_SECRET.appleTeamId]: HARNESS_APPLE_TEAM_ID,
    [INHOUSE_AUTH_SECRET.appleKeyId]: HARNESS_APPLE_KEY_ID,
    [INHOUSE_AUTH_SECRET.applePrivateJwk]: JSON.stringify(keys.privateJwk),
  };
}

/** One relying-party key per process: minting it is not what any harness tests. */
let appleKeys: Promise<AppleClientKeys> | null = null;

export function harnessAppleClientKeys(): Promise<AppleClientKeys> {
  appleKeys ??= createAppleClientKeys();
  return appleKeys;
}

async function openIdpStore(
  provider: IdpProviderKind,
  deps: {
    readonly clock: Clock;
    readonly createId: CreateId;
    readonly sqlClient: SqlClient;
  }
): Promise<IdpStore> {
  return await IdpStore.open({
    provider,
    sqlClient: deps.sqlClient,
    clock: deps.clock,
    createId: deps.createId,
    createKeys: () => createIdpSigningKeys(),
  });
}

export async function createHarnessIdps(deps: {
  readonly clock: Clock;
  readonly createId: CreateId;
  /** One SQLite per provider (in-memory under the default fabric). */
  readonly sqlClients: Readonly<Record<IdpProviderKind, SqlClient>>;
  readonly appleKeys: AppleClientKeys;
  /** The Apple node's egress: notifications go through the balancer. */
  readonly toApi: () => ServerHttp;
}): Promise<HarnessIdps> {
  const google = await createIdpMockApp({
    store: await openIdpStore('google', {
      ...deps,
      sqlClient: deps.sqlClients.google,
    }),
    issuer: HARNESS_IDP_URL,
    clients: [
      {
        clientId: HARNESS_GOOGLE_CLIENT_ID,
        clientSecret: HARNESS_GOOGLE_CLIENT_SECRET,
        redirectUris: [HARNESS_GOOGLE_REDIRECT_URI],
        appName: 'Gamezilla',
      },
    ],
  });
  const apple = await createIdpMockApp({
    store: await openIdpStore('apple', {
      ...deps,
      sqlClient: deps.sqlClients.apple,
    }),
    issuer: HARNESS_APPLE_IDP_URL,
    http: { fetch: (input, init) => deps.toApi()(input, init) },
    clients: [
      {
        clientId: HARNESS_APPLE_CLIENT_ID,
        clientSecret: '',
        redirectUris: [HARNESS_APPLE_REDIRECT_URI],
        appName: 'Gamezilla',
        apple: {
          teamId: HARNESS_APPLE_TEAM_ID,
          keyId: HARNESS_APPLE_KEY_ID,
          publicJwk: { ...deps.appleKeys.publicJwk },
          notificationUrl: HARNESS_APPLE_NOTIFICATION_URL,
        },
      },
    ],
  });
  return { google, apple };
}

/** Give an actor their accounts at both providers. */
export async function addHarnessIdpAccounts(
  idps: HarnessIdps,
  actorId: string
): Promise<void> {
  const apple = harnessAppleEmails(actorId);
  await idps.google.addAccount({
    handle: actorId,
    email: harnessIdpEmail(actorId),
  });
  await idps.apple.addAccount({ handle: actorId, email: apple.sameAsGoogle });
  await idps.apple.addAccount({ handle: actorId, email: apple.icloud });
}

/** The provider an absolute URL belongs to, or `null`. */
export function harnessIdpOf(href: string): IdpProviderKind | null {
  if (href.startsWith(HARNESS_IDP_URL)) return 'google';
  if (href.startsWith(HARNESS_APPLE_IDP_URL)) return 'apple';
  return null;
}

/** A node's HTTP port to the providers, each hop gated by the network. */
export function harnessIdpFetchFrom(args: {
  readonly idps: HarnessIdps;
  readonly net: HarnessNet;
  readonly from: string;
}): ServerHttp {
  const hops = {
    google: args.net.wrapHop(args.from, NODE_IDS.google, async (input, init) =>
      args.idps.google.app.fetch(new Request(requestHref(input), init))
    ),
    apple: args.net.wrapHop(args.from, NODE_IDS.apple, async (input, init) =>
      args.idps.apple.app.fetch(new Request(requestHref(input), init))
    ),
  };
  return async (input, init) => {
    const provider = harnessIdpOf(requestHref(input));
    if (provider === null) return new Response('not found', { status: 404 });
    return await hops[provider](input, init);
  };
}

/**
 * A client's browser: each provider on its own origin, everything else
 * through the load balancer. One port, several destinations — same as a real
 * browser.
 */
export function harnessBrowserFetch(args: {
  readonly idps: HarnessIdps;
  readonly billing: HarnessBillingProviders | null;
  readonly net: HarnessNet;
  readonly from: string;
  readonly server: ServerHttp;
}): ServerHttp {
  const toIdp = harnessIdpFetchFrom(args);
  const billing = args.billing;
  return async (input, init) => {
    const href = requestHref(input);
    if (harnessIdpOf(href) !== null) return toIdp(input, init);
    const provider = billing?.at(href);
    if (provider !== undefined) {
      const hop = harnessBillingFetchFrom({
        billing: provider,
        net: args.net,
        from: args.from,
      });
      return hop(input, init);
    }
    return args.server(input, init);
  };
}
