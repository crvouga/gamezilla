/**
 * The auth system's stimuli. Each samples its own arguments from the live
 * surface, so a random walk covers every provider, every directory entry
 * (plus an address nobody holds), both consent answers, both email choices,
 * offline devices, provider-side account changes and provider faults.
 */

import { OAUTH_PROVIDER_IDS, type OauthProviderId } from '@pkgs/auth/shared';
import { AUTH_SESSION_TTL_MS } from '@pkgs/auth-inhouse/shared';
import type { IdpFaults } from '@pkgs/idp-sim/shared';
import { defineAction } from '@pkgs/sim';
import { gen } from '@pkgs/sim/fast-check';
import fc from 'fast-check';

import {
  linkFlow,
  prepareLinkFlow,
  signOutEverywhereFlow,
  signOutFlow,
  stealBearerFlow,
  unlinkFlow,
} from './account-flows';
import {
  confirmPendingFlow,
  declinePendingFlow,
  signInFlow,
} from './client-flows';
import { migrateAuthSchema } from './nodes';
import type { AuthSurface, ProviderAnswers } from './types';
import { requireActor } from './types';
import {
  appleAccountDeletedFlow,
  appleConsentRevokedFlow,
  appleRelayForwardingFlow,
  googleEmailChangedFlow,
  rotateKeysFlow,
  setFaultsFlow,
} from './world-flows';

/** An address no directory holds: the provider refuses it. */
export const GHOST_EMAIL = 'ghost@nowhere.test';

/** Provider misbehaviour, by name, so recordings stay readable. */
export const AUTH_FAULTS: Readonly<
  Record<string, { provider: OauthProviderId; patch: Partial<IdpFaults> }>
> = {
  'google.token-500': {
    provider: 'google',
    patch: { tokenEndpoint: 'server_error' },
  },
  'google.invalid-client': {
    provider: 'google',
    patch: { tokenEndpoint: 'invalid_client' },
  },
  'google.userinfo-500': {
    provider: 'google',
    patch: { userinfoEndpoint: 'server_error' },
  },
  'google.userinfo-401': {
    provider: 'google',
    patch: { userinfoEndpoint: 'unauthorized' },
  },
  'google.deny': { provider: 'google', patch: { denyConsent: true } },
  'google.no-refresh-token': {
    provider: 'google',
    patch: { withholdRefreshToken: true },
  },
  'apple.token-500': {
    provider: 'apple',
    patch: { tokenEndpoint: 'server_error' },
  },
  'apple.deny': { provider: 'apple', patch: { denyConsent: true } },
  'apple.string-booleans': {
    provider: 'apple',
    patch: { stringBooleanClaims: true },
  },
  'apple.clock-ahead-2m': {
    provider: 'apple',
    patch: { idTokenClockSkewSeconds: 120 },
  },
  'apple.clock-ahead-10m': {
    provider: 'apple',
    patch: { idTokenClockSkewSeconds: 600 },
  },
  'apple.token-stale-2h': {
    provider: 'apple',
    patch: { idTokenClockSkewSeconds: -7200 },
  },
  'apple.unknown-key': {
    provider: 'apple',
    patch: { idTokenSignedWithUnknownKey: true },
  },
};

export function clientIds(s: AuthSurface): string[] {
  return [...s.clients.keys()];
}

function arbProvider(): fc.Arbitrary<OauthProviderId> {
  return fc.constantFrom(...OAUTH_PROVIDER_IDS);
}

/**
 * Addresses held at both providers are where linking happens, so they are
 * drawn three times as often as the rest.
 */
function arbEmail(
  s: AuthSurface,
  provider: OauthProviderId
): fc.Arbitrary<string> {
  const shared = s.directory[provider].filter((email) =>
    OAUTH_PROVIDER_IDS.every((other) => s.directory[other].includes(email))
  );
  return fc.oneof(
    {
      weight: 1,
      arbitrary: fc.constantFrom(...s.directory[provider], GHOST_EMAIL),
    },
    ...(shared.length === 0
      ? []
      : [{ weight: 2, arbitrary: fc.constantFrom(...shared) }])
  );
}

function arbAnswers(
  s: AuthSurface,
  provider: OauthProviderId
): fc.Arbitrary<ProviderAnswers> {
  return fc.record({
    email: arbEmail(s, provider),
    consent: fc.constantFrom<'allow' | 'deny'>(
      'allow',
      'allow',
      'allow',
      'deny'
    ),
    emailChoice: fc.constantFrom<'share' | 'hide'>('share', 'hide'),
  });
}

export type ProviderStepArgs = {
  readonly clientId: string;
  readonly provider: OauthProviderId;
  readonly answers: ProviderAnswers;
};

function arbProviderStep(
  s: AuthSurface,
  ids: readonly string[]
): fc.Arbitrary<ProviderStepArgs> {
  return fc
    .record({
      clientId: fc.constantFrom(...ids),
      provider: arbProvider(),
    })
    .chain(({ clientId, provider }) =>
      arbAnswers(s, provider).map((answers) => ({
        clientId,
        provider,
        answers,
      }))
    );
}

/** Account actions mostly come from signed-in devices (sometimes not). */
function arbAccountClient(s: AuthSurface): fc.Arbitrary<string> {
  const signedIn = clientIds(s).filter(
    (id) => s.clients.get(id)?.bearer !== null
  );
  return fc.oneof(
    { weight: 1, arbitrary: fc.constantFrom(...clientIds(s)) },
    ...(signedIn.length === 0
      ? []
      : [{ weight: 4, arbitrary: fc.constantFrom(...signedIn) }])
  );
}

function arbAccountStep(s: AuthSurface): fc.Arbitrary<ProviderStepArgs> {
  return fc
    .record({ clientId: arbAccountClient(s), provider: arbProvider() })
    .chain(({ clientId, provider }) =>
      arbAnswers(s, provider).map((answers) => ({
        clientId,
        provider,
        answers,
      }))
    );
}

function withPending(s: AuthSurface): string[] {
  return clientIds(s).filter((id) => s.clients.get(id)?.pendingLink !== null);
}

export const signIn = defineAction({
  name: 'signIn',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  weight: 6,
  sample: (s: AuthSurface) => gen(arbProviderStep(s, clientIds(s))),
  act: async (s: AuthSurface, args: ProviderStepArgs) => {
    const actor = requireActor(s.clients, args.clientId);
    await signInFlow(s, actor, args.provider, args.answers);
  },
});

/**
 * Mostly what the app suggests (a provider that can prove the account, as
 * that account), sometimes anything — which is how mismatches get tested.
 */
function arbConfirmStep(s: AuthSurface): fc.Arbitrary<ProviderStepArgs> {
  const suggested = withPending(s).flatMap((clientId) => {
    const pending = s.clients.get(clientId)?.pendingLink;
    if (pending === null || pending === undefined) return [];
    return pending.providers.flatMap((provider) =>
      pending.emails.map((email) => ({ clientId, provider, email }))
    );
  });
  const guided =
    suggested.length === 0
      ? []
      : [
          {
            weight: 3,
            arbitrary: fc
              .constantFrom(...suggested)
              .map(({ clientId, provider, email }) => ({
                clientId,
                provider,
                answers: {
                  email,
                  consent: 'allow' as const,
                  emailChoice: 'share' as const,
                },
              })),
          },
        ];
  return fc.oneof(
    { weight: 1, arbitrary: arbProviderStep(s, withPending(s)) },
    ...guided
  );
}

export const confirmPendingLink = defineAction({
  name: 'confirmPendingLink',
  enabled: (s: AuthSurface) => withPending(s).length > 0,
  weight: 8,
  sample: (s: AuthSurface) => gen(arbConfirmStep(s)),
  act: async (s: AuthSurface, args: ProviderStepArgs) => {
    const actor = requireActor(s.clients, args.clientId);
    await confirmPendingFlow(s, actor, args.provider, args.answers);
  },
});

export const declinePendingLink = defineAction({
  name: 'declinePendingLink',
  enabled: (s: AuthSurface) => withPending(s).length > 0,
  weight: 4,
  sample: (s: AuthSurface) => gen(fc.constantFrom(...withPending(s))),
  act: async (s: AuthSurface, clientId: string) => {
    await declinePendingFlow(s, requireActor(s.clients, clientId));
  },
});

export const linkProvider = defineAction({
  name: 'linkProvider',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  weight: 4,
  sample: (s: AuthSurface) => gen(arbAccountStep(s)),
  act: async (s: AuthSurface, args: ProviderStepArgs) => {
    const actor = requireActor(s.clients, args.clientId);
    await linkFlow(s, actor, args.provider, args.answers);
  },
});

/**
 * The account screen mints a link ticket as it opens, long before any tap —
 * and may keep it while the device signs out and in as someone else. Linking
 * must never spend a ticket minted for a different session.
 */
export const prepareLink = defineAction({
  name: 'prepareLink',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  sample: (s: AuthSurface) => gen(arbAccountClient(s)),
  act: async (s: AuthSurface, clientId: string) => {
    await prepareLinkFlow(s, requireActor(s.clients, clientId));
  },
});

export const unlinkProvider = defineAction({
  name: 'unlinkProvider',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  weight: 2,
  sample: (s: AuthSurface) =>
    gen(fc.record({ clientId: arbAccountClient(s), provider: arbProvider() })),
  act: async (
    s: AuthSurface,
    args: { readonly clientId: string; readonly provider: OauthProviderId }
  ) => {
    await unlinkFlow(s, requireActor(s.clients, args.clientId), args.provider);
  },
});

export const signOut = defineAction({
  name: 'signOut',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  weight: 2,
  sample: (s: AuthSurface) => gen(fc.constantFrom(...clientIds(s))),
  act: async (s: AuthSurface, clientId: string) => {
    await signOutFlow(s, requireActor(s.clients, clientId));
  },
});

export const signOutEverywhere = defineAction({
  name: 'signOutEverywhere',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  sample: (s: AuthSurface) => gen(arbAccountClient(s)),
  act: async (s: AuthSurface, clientId: string) => {
    await signOutEverywhereFlow(s, requireActor(s.clients, clientId));
  },
});

export const setOnline = defineAction({
  name: 'setOnline',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  sample: (s: AuthSurface) =>
    gen(
      fc.record({
        clientId: fc.constantFrom(...clientIds(s)),
        online: fc.constantFrom(true, true, false),
      })
    ),
  act: (
    s: AuthSurface,
    args: { readonly clientId: string; readonly online: boolean }
  ) => {
    requireActor(s.clients, args.clientId).online = args.online;
  },
});

export const stealBearer = defineAction({
  name: 'stealBearer',
  enabled: (s: AuthSurface) => clientIds(s).length > 1,
  weight: 0.5,
  sample: (s: AuthSurface) =>
    gen(
      fc.record({
        from: fc.constantFrom(...clientIds(s)),
        to: fc.constantFrom(...clientIds(s)),
      })
    ),
  act: async (
    s: AuthSurface,
    args: { readonly from: string; readonly to: string }
  ) => {
    if (args.from === args.to) return;
    await stealBearerFlow(
      s,
      requireActor(s.clients, args.from),
      requireActor(s.clients, args.to)
    );
  },
});

export const appleConsentRevoked = defineAction({
  name: 'appleConsentRevoked',
  sample: (s: AuthSurface) => gen(arbEmail(s, 'apple')),
  act: async (s: AuthSurface, email: string) => {
    await appleConsentRevokedFlow(s, email);
  },
});

export const appleAccountDeleted = defineAction({
  name: 'appleAccountDeleted',
  weight: 0.3,
  sample: (s: AuthSurface) => gen(arbEmail(s, 'apple')),
  act: async (s: AuthSurface, email: string) => {
    await appleAccountDeletedFlow(s, email);
  },
});

export const appleRelayForwarding = defineAction({
  name: 'appleRelayForwarding',
  weight: 0.5,
  sample: (s: AuthSurface) =>
    gen(fc.record({ email: arbEmail(s, 'apple'), forwarding: fc.boolean() })),
  act: async (
    s: AuthSurface,
    args: { readonly email: string; readonly forwarding: boolean }
  ) => {
    await appleRelayForwardingFlow(s, args.email, args.forwarding);
  },
});

export const googleEmailChanged = defineAction({
  name: 'googleEmailChanged',
  weight: 0.3,
  sample: (s: AuthSurface) => gen(arbEmail(s, 'google')),
  act: async (s: AuthSurface, email: string) => {
    await googleEmailChangedFlow(s, email);
  },
});

export const setProviderFault = defineAction({
  name: 'setProviderFault',
  sample: () => gen(fc.constantFrom(...Object.keys(AUTH_FAULTS))),
  act: async (s: AuthSurface, name: string) => {
    const fault = AUTH_FAULTS[name];
    if (fault !== undefined)
      await setFaultsFlow(s, fault.provider, fault.patch);
  },
});

export const clearProviderFaults = defineAction({
  name: 'clearProviderFaults',
  weight: 2,
  sample: () => gen(arbProvider()),
  act: async (s: AuthSurface, provider: OauthProviderId) => {
    await setFaultsFlow(s, provider, null);
  },
});

export const rotateProviderKeys = defineAction({
  name: 'rotateProviderKeys',
  weight: 0.5,
  sample: () => gen(arbProvider()),
  act: async (s: AuthSurface, provider: OauthProviderId) => {
    await rotateKeysFlow(s, provider);
  },
});

export const advanceClock = defineAction({
  name: 'advanceClock',
  enabled: (s: AuthSurface) => s.session.caps.has('virtualTime'),
  sample: () =>
    gen(fc.constantFrom(1_000, 11 * 60 * 1000, AUTH_SESSION_TTL_MS + 1)),
  act: async (s: AuthSurface, ms: number) => {
    await s.session.advanceTime(ms);
  },
});

/** Re-run the schema migration against the live store (idempotence pin). */
export const migrateSchema = defineAction({
  name: 'migrateSchema',
  weight: 0.2,
  act: async (s: AuthSurface) => {
    await migrateAuthSchema(s.store.fabric, s.store.sql);
  },
});

export type FetchAuthArgs = {
  readonly path: string;
  readonly init?: RequestInit;
};

/** A raw request against the auth app (scenario tests only). */
export const fetchAuth = defineAction({
  name: 'fetchAuth',
  pool: false,
  act: async (s: AuthSurface, req: FetchAuthArgs) => {
    const res = await s.store.fetch(req.path, req.init);
    s.lastStatus = res.status;
  },
});

export const AUTH_ACTIONS = [
  signIn,
  confirmPendingLink,
  declinePendingLink,
  linkProvider,
  prepareLink,
  unlinkProvider,
  signOut,
  signOutEverywhere,
  setOnline,
  stealBearer,
  appleConsentRevoked,
  appleAccountDeleted,
  appleRelayForwarding,
  googleEmailChanged,
  setProviderFault,
  clearProviderFaults,
  rotateProviderKeys,
  advanceClock,
  migrateSchema,
  fetchAuth,
] as const;
