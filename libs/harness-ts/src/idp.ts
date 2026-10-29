/**
 * The identity-provider nodes.
 *
 * Production signs in through Google, and non-production also through Sign
 * in with Apple, so the simulation runs one whole simulated provider of each
 * flavor (`@crvouga/mockingbird-service-oauth`, on Google's and Apple's wire
 * profiles): its own origin, its own account directory, its own browser
 * sessions and consent grants, real RS256 ID tokens and a real JWKS. Nothing
 * about them is shared with the API — the only way in is each provider's
 * documented OAuth conversation, so the production exchange paths are the
 * ones under test. The Apple node reaches back only through the load
 * balancer, with signed server-to-server notifications, as Apple does.
 *
 * Each sits on `createHarnessNet` like every other node, so it can be
 * partitioned away from a client or from the API and the product has to cope.
 */

import {
  createRuntime,
  type OAuthRuntime,
  type OAuthRuntimeOptions,
} from '@crvouga/mockingbird-service-oauth';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
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
} from '@libs/sub-shared-ts/harness-constants';
import type { ServerHttp } from '@libs/sub-shared-ts/sync';
import { INHOUSE_AUTH_SECRET } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-config';
import type { Clock } from '@pkgs/clock-shared-ts/types';

import type { HarnessBillingProviders } from './billing';
import { harnessBillingFetchFrom } from './billing';
import { requestHref } from './http-request';
import type { HarnessNet } from './net';

/** The sign-in providers the harness runs. */
export type HarnessIdpProvider = 'google' | 'apple';

/** Network node ids, one per provider (partitionable independently). */
export const HARNESS_IDP_ID = 'idp';
export const HARNESS_APPLE_IDP_ID = 'idp-apple';

const NODE_IDS: Readonly<Record<HarnessIdpProvider, string>> = {
  google: HARNESS_IDP_ID,
  apple: HARNESS_APPLE_IDP_ID,
};

const ORIGINS: Readonly<Record<HarnessIdpProvider, string>> = {
  google: HARNESS_IDP_URL,
  apple: HARNESS_APPLE_IDP_URL,
};

/** Where the API's callbacks land (`createServer` mounts under `/api`). */
export const HARNESS_GOOGLE_REDIRECT_URI = `${HARNESS_SERVER_URL}/api/auth/callback/google`;
export const HARNESS_APPLE_REDIRECT_URI = `${HARNESS_SERVER_URL}/api/auth/callback/apple`;
export const HARNESS_APPLE_NOTIFICATION_URL = `${HARNESS_SERVER_URL}/api/auth/apple/notifications`;

/** An account in a provider's directory, as a scenario describes one. */
export type HarnessIdpAccount = {
  /** The person's handle (`alice`); their name is made from it. */
  readonly handle: string;
  readonly email: string;
  /** Default `true`. */
  readonly emailVerified?: boolean;
};

/** One provider node: its directory and its wire. */
export type HarnessIdp = {
  readonly provider: HarnessIdpProvider;
  readonly origin: string;
  readonly runtime: OAuthRuntime;
  /** Operator access (the harness's controls): no network hop. */
  readonly fetch: ServerHttp;
  /** Put an account in the directory, or update the one at its address. */
  addAccount(account: HarnessIdpAccount): void;
};

export type HarnessIdps = Readonly<Record<HarnessIdpProvider, HarnessIdp>>;

/**
 * The provider's id for the account at `email` — its Google subject, the key
 * of its row in the account chooser. Stable, so a scenario knows it without
 * asking.
 */
export function harnessIdpAccountId(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

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

/** The key pair the API signs its Sign in with Apple client secret with. */
export type AppleClientKeys = {
  readonly privateJwk: JsonWebKey;
  readonly publicJwk: JsonWebKey;
};

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

/** One relying-party key per process: minting it is not what any harness tests. */
let appleKeys: Promise<AppleClientKeys> | null = null;

export function harnessAppleClientKeys(): Promise<AppleClientKeys> {
  appleKeys ??= createAppleClientKeys();
  return appleKeys;
}

type ProviderClock = NonNullable<OAuthRuntimeOptions['clock']>;

/** The harness clock, as the provider reads it. */
function providerClock(app: Clock): ProviderClock {
  const now = (): number => app.now();
  return {
    now,
    set: () => undefined,
    advance: () => undefined,
    freeze: () => undefined,
    unfreeze: () => undefined,
    reset: () => undefined,
    state: () => ({ now: now(), frozen: false, offsetMs: 0 }),
  };
}

function titleCase(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function createHarnessIdp(
  provider: HarnessIdpProvider,
  options: Pick<
    OAuthRuntimeOptions,
    'behavior' | 'clients' | 'clock' | 'webhooks'
  >
): HarnessIdp {
  const origin = ORIGINS[provider];
  const runtime = createRuntime({
    provider,
    issuer: origin,
    seed: `harness-idp:${provider}`,
    deterministicCredentials: true,
    ...options,
  });
  return {
    provider,
    origin,
    runtime,
    fetch: async (input, init) =>
      await runtime.fetch(new Request(requestHref(input), init)),
    addAccount: (account) => {
      const handle = account.handle.trim().toLowerCase();
      const givenName = titleCase(handle);
      runtime.instance().seedAccount({
        id: harnessIdpAccountId(account.email),
        email: account.email,
        emailVerified: account.emailVerified ?? true,
        name: `${givenName} Tester`,
        givenName,
        familyName: 'Tester',
        ...(provider === 'google'
          ? { picture: `https://lh3.googleusercontent.com/a/${handle}=s96-c` }
          : {}),
      });
    },
  };
}

export function createHarnessIdps(deps: {
  readonly clock: Clock;
  readonly appleKeys: AppleClientKeys;
  /** The Apple node's egress: notifications go through the balancer. */
  readonly toApi: () => ServerHttp;
}): HarnessIdps {
  const clock = providerClock(deps.clock);
  return {
    google: createHarnessIdp('google', {
      clock,
      clients: [
        {
          id: HARNESS_GOOGLE_CLIENT_ID,
          name: PRODUCT_NAME,
          secret: HARNESS_GOOGLE_CLIENT_SECRET,
          redirectUris: [HARNESS_GOOGLE_REDIRECT_URI],
        },
      ],
    }),
    apple: createHarnessIdp('apple', {
      clock,
      // Apple asks which Apple Account to continue with, even in a browser
      // signed in to one (Google is asked by the app: `prompt=select_account`).
      behavior: { session: { reuseLastAccount: false } },
      webhooks: {
        fetch: async (request) =>
          await deps.toApi()(request.url, {
            method: request.method,
            headers: request.headers,
            body: await request.text(),
          }),
      },
      clients: [
        {
          id: HARNESS_APPLE_CLIENT_ID,
          name: PRODUCT_NAME,
          redirectUris: [HARNESS_APPLE_REDIRECT_URI],
          apple: {
            teamId: HARNESS_APPLE_TEAM_ID,
            keyId: HARNESS_APPLE_KEY_ID,
            publicKey: { ...deps.appleKeys.publicJwk },
            notificationUrl: HARNESS_APPLE_NOTIFICATION_URL,
          },
        },
      ],
    }),
  };
}

/** Give an actor their accounts at both providers. */
export function addHarnessIdpAccounts(
  idps: HarnessIdps,
  actorId: string
): void {
  const apple = harnessAppleEmails(actorId);
  idps.google.addAccount({ handle: actorId, email: harnessIdpEmail(actorId) });
  idps.apple.addAccount({ handle: actorId, email: apple.sameAsGoogle });
  idps.apple.addAccount({ handle: actorId, email: apple.icloud });
}

/** The provider an absolute URL belongs to, or `null`. */
export function harnessIdpOf(href: string): HarnessIdpProvider | null {
  if (href.startsWith(HARNESS_IDP_URL)) return 'google';
  if (href.startsWith(HARNESS_APPLE_IDP_URL)) return 'apple';
  return null;
}

/** A node's HTTP port to the providers, each hop gated by the network. */
export function harnessIdpFetchFrom(args: {
  readonly idps: HarnessIdps;
  readonly net: HarnessNet;
  readonly from: string;
  /** Told each request no provider serves, before it is answered `404`. */
  readonly onUnanswered?: (href: string) => void;
}): ServerHttp {
  const hops = {
    google: args.net.wrapHop(
      args.from,
      NODE_IDS.google,
      args.idps.google.fetch
    ),
    apple: args.net.wrapHop(args.from, NODE_IDS.apple, args.idps.apple.fetch),
  };
  return async (input, init) => {
    const href = requestHref(input);
    const provider = harnessIdpOf(href);
    if (provider === null) {
      args.onUnanswered?.(href);
      return new Response('not found', { status: 404 });
    }
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
