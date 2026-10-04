/**
 * The example app's providers: Google and Apple, simulated
 * (`@crvouga/mockingbird-service-oauth` on each one's wire profile), each on
 * its own origin with its own directory, sessions, grants and misbehaviour,
 * with the example app registered as their one client. The example app
 * reaches them only over HTTP, and the Apple node reaches back only over HTTP
 * (its server-to-server notifications), so the production code paths are
 * the ones exercised.
 */

import {
  type Account,
  type BehaviorInput,
  createRuntime,
  type OAuthRuntime,
  type OAuthRuntimeOptions,
} from '@crvouga/mockingbird-service-oauth';
import type { OauthProviderId } from '@pkgs/auth-shared/sign-in-method';
import type { Ports } from '@pkgs/harness-shared/runtime-types';
import type { HttpClient } from '@pkgs/http-client-shared/types';

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

/** An account in a provider's directory. */
export type DirectoryEntry = {
  readonly handle: string;
  /** Default `<handle>@gmail.com` at Google, `<handle>@icloud.com` at Apple. */
  readonly email?: string;
  /** Default `true`. */
  readonly emailVerified?: boolean;
  /** A Google Workspace account's domain (`hd`). */
  readonly hostedDomain?: string;
  /** Apple's risk signal: 0 unsupported, 1 unknown, 2 likely real. */
  readonly realUserStatus?: 0 | 1 | 2;
};

/**
 * Who exists where. `chris`, `wendy`, `uma` and `vic` hold both a Google and
 * an Apple account — the cases linking by address exists for. Google vouches
 * for chris's and wendy's (Workspace) addresses, so those link on their own;
 * it does not vouch for uma's or vic's, so those must be proven.
 */
export const GOOGLE_DIRECTORY: readonly DirectoryEntry[] = [
  { handle: 'alice' },
  { handle: 'bob' },
  { handle: 'chris' },
  { handle: 'uma', email: 'uma@unverified.test', emailVerified: false },
  { handle: 'vic', email: 'vic@unverified.test', emailVerified: false },
  {
    handle: 'wendy',
    email: 'wendy@workspace.test',
    hostedDomain: 'workspace.test',
  },
];

export const APPLE_DIRECTORY: readonly DirectoryEntry[] = [
  { handle: 'alice' },
  { handle: 'chris', email: 'chris@gmail.com' },
  { handle: 'uma', email: 'uma@unverified.test' },
  { handle: 'vic', email: 'vic@unverified.test' },
  { handle: 'wendy', email: 'wendy@workspace.test' },
  { handle: 'dan', realUserStatus: 2 },
];

export const DIRECTORIES: Readonly<
  Record<OauthProviderId, readonly DirectoryEntry[]>
> = { google: GOOGLE_DIRECTORY, apple: APPLE_DIRECTORY };

const DEFAULT_DOMAIN: Readonly<Record<OauthProviderId, string>> = {
  google: 'gmail.com',
  apple: 'icloud.com',
};

export function emailOfEntry(
  entry: DirectoryEntry,
  provider: OauthProviderId
): string {
  return entry.email ?? `${entry.handle}@${DEFAULT_DOMAIN[provider]}`;
}

/** The provider's id for the account first registered at `email` (its Google `sub`). */
export function accountIdOf(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function accountOf(entry: DirectoryEntry, provider: OauthProviderId): Account {
  const email = emailOfEntry(entry, provider);
  const id = accountIdOf(email);
  const givenName =
    entry.handle.charAt(0).toUpperCase() + entry.handle.slice(1);
  return {
    id,
    email,
    name: `${givenName} Tester`,
    givenName,
    familyName: 'Tester',
    emailVerified: entry.emailVerified ?? true,
    ...(entry.hostedDomain === undefined
      ? {}
      : { hostedDomain: entry.hostedDomain }),
    ...(entry.realUserStatus === undefined
      ? {}
      : { realUserStatus: entry.realUserStatus }),
    // Pinned, so the model knows the address Hide My Email gives the app.
    ...(provider === 'apple'
      ? { relayEmail: `${id}@privaterelay.appleid.com` }
      : {}),
  };
}

/** How a provider misbehaves, switched on one knob at a time. */
export type ProviderFaults = {
  readonly tokenEndpoint: 'ok' | 'server_error' | 'invalid_client';
  readonly userinfoEndpoint: 'ok' | 'server_error' | 'unauthorized';
  readonly denyConsent: boolean;
  readonly withholdRefreshToken: boolean;
  /** Apple's `email_verified` / `is_private_email` as `"true"` strings. */
  readonly stringBooleanClaims: boolean;
  /** ID tokens issued this far ahead of the clock (negative: in the past). */
  readonly idTokenClockSkewSeconds: number;
  readonly idTokenSignedWithUnknownKey: boolean;
};

export const NO_PROVIDER_FAULTS: ProviderFaults = {
  tokenEndpoint: 'ok',
  userinfoEndpoint: 'ok',
  denyConsent: false,
  withholdRefreshToken: false,
  stringBooleanClaims: false,
  idTokenClockSkewSeconds: 0,
  idTokenSignedWithUnknownKey: false,
};

/** One provider node: its directory, its wire and its misbehaviour. */
export type AuthIdp = {
  readonly provider: OauthProviderId;
  readonly origin: string;
  readonly runtime: OAuthRuntime;
  readonly fetch: (request: Request) => Promise<Response>;
  faults(): ProviderFaults;
  setFaults(faults: ProviderFaults): void;
};

export type AuthIdps = Readonly<Record<OauthProviderId, AuthIdp>>;

const TOKEN_PATH: Readonly<Record<OauthProviderId, string>> = {
  google: '/token',
  apple: '/auth/token',
};

function behaviorOf(
  provider: OauthProviderId,
  faults: ProviderFaults
): BehaviorInput {
  return {
    // Apple asks which Apple Account to continue with, every time.
    ...(provider === 'apple'
      ? {
          session: { reuseLastAccount: false },
          apple: {
            booleanClaims: faults.stringBooleanClaims ? 'string' : 'boolean',
          },
        }
      : {}),
    ...(faults.denyConsent ? { consent: { error: 'access_denied' } } : {}),
    ...(faults.withholdRefreshToken
      ? { google: { refreshToken: 'never' } }
      : {}),
    tokens: {
      ...(faults.idTokenClockSkewSeconds === 0
        ? {}
        : { idTokenClockSkewSeconds: faults.idTokenClockSkewSeconds }),
      ...(faults.idTokenSignedWithUnknownKey
        ? { idTokenSigningKey: 'unpublished' }
        : {}),
    },
  } as BehaviorInput;
}

/** The provider's endpoints that answer with an error while `faults` hold. */
function faultRulesOf(provider: OauthProviderId, faults: ProviderFaults) {
  const token =
    faults.tokenEndpoint === 'ok'
      ? []
      : [
          {
            id: 'token',
            method: 'POST',
            pathPrefix: TOKEN_PATH[provider],
            status: faults.tokenEndpoint === 'server_error' ? 500 : 401,
            body: { error: faults.tokenEndpoint },
          },
        ];
  const userinfo =
    provider !== 'google' || faults.userinfoEndpoint === 'ok'
      ? []
      : [
          {
            id: 'userinfo',
            pathPrefix: '/v1/userinfo',
            status: faults.userinfoEndpoint === 'server_error' ? 500 : 401,
            body: { error: faults.userinfoEndpoint },
          },
        ];
  return [...token, ...userinfo];
}

type ProviderClock = NonNullable<OAuthRuntimeOptions['clock']>;

function providerClock(ports: Ports): ProviderClock {
  const now = (): number => ports.clock.now();
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

function startIdp(
  provider: OauthProviderId,
  options: Pick<
    OAuthRuntimeOptions,
    'clients' | 'clock' | 'issuer' | 'webhooks'
  >
): AuthIdp {
  const runtime = createRuntime({
    provider,
    ...options,
    accounts: DIRECTORIES[provider].map((entry) => accountOf(entry, provider)),
    behavior: behaviorOf(provider, NO_PROVIDER_FAULTS),
  });
  let current = NO_PROVIDER_FAULTS;
  return {
    provider,
    origin: options.issuer ?? '',
    runtime,
    fetch: async (request) => await runtime.fetch(request),
    faults: () => current,
    setFaults: (faults) => {
      current = faults;
      runtime.instance().configureBehavior(behaviorOf(provider, faults));
      runtime.faults.clear();
      for (const rule of faultRulesOf(provider, faults))
        runtime.faults.add(rule);
    },
  };
}

export async function startIdpNodes(args: {
  readonly ports: Ports;
  /** The provider's egress: Apple's notifications go back to the auth app. */
  readonly egress: HttpClient;
}): Promise<AuthIdps> {
  const apple = await sharedAppleKeys();
  const clock = providerClock(args.ports);
  return {
    google: startIdp('google', {
      clock,
      issuer: GOOGLE_ORIGIN,
      clients: [
        {
          id: GOOGLE_CLIENT_ID,
          name: EXAMPLE_APP_NAME,
          secret: GOOGLE_CLIENT_SECRET,
          redirectUris: [`${EXAMPLE_APP_API}/auth/callback/google`],
        },
      ],
    }),
    apple: startIdp('apple', {
      clock,
      issuer: APPLE_ORIGIN,
      webhooks: {
        fetch: async (request) =>
          await args.egress.fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: await request.text(),
          }),
      },
      clients: [
        {
          id: APPLE_CLIENT_ID,
          name: EXAMPLE_APP_NAME,
          redirectUris: [`${EXAMPLE_APP_API}/auth/callback/apple`],
          apple: {
            teamId: APPLE_TEAM_ID,
            keyId: APPLE_KEY_ID,
            publicKey: { ...apple.publicJwk },
            notificationUrl: `${EXAMPLE_APP_API}/auth/apple/notifications`,
          },
        },
      ],
    }),
  };
}

/** Which node owns `url`, or `null` for the auth app itself. */
export function idpForUrl(idps: AuthIdps, url: string): AuthIdp | null {
  if (url.startsWith(GOOGLE_ORIGIN)) return idps.google;
  if (url.startsWith(APPLE_ORIGIN)) return idps.apple;
  return null;
}

/** The account at `email` in `idp`'s directory right now, if any. */
export function accountAt(idp: AuthIdp, email: string): Account | null {
  const found = idp.runtime
    .instance()
    .accounts.list({ order: 'oldest' })
    .find(({ value }) => value.email === email);
  return found?.value ?? null;
}
