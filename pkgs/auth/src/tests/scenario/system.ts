import { defineSystem } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import {
  AUTH_SESSION_TTL_MS,
  IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '../../shared/auth-constants';
import {
  dispatchOauthApprove,
  dispatchOauthStart,
  dispatchSessionExchange,
  dispatchSignOut,
  dispatchStealBearer,
  type OauthProvider,
} from './dispatch';
import { assertAuthInvariants, authFingerprint } from './invariants';
import { migrateAuthSchema, startActor, startStore } from './nodes';
import type { AuthFabric, AuthSurface } from './types';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

const SUBJECTS = ['alice', 'bob', 'carol'] as const;
const PROVIDERS = [IDP_PROVIDER_GOOGLE, IDP_PROVIDER_DEV] as const;
const CALLBACK_URLS = [
  'http://callback.test/sso',
  'gamezilla://sso-callback',
  'https://evil.example/sso',
] as const;

export type AuthKnobs = {
  readonly fabric: AuthFabric;
  readonly clientCount: number;
  readonly enableDev: boolean;
  readonly enableGoogle: boolean;
};

export const auth = defineSystem({
  name: 'auth.idp',
  async generate(session, knobs: AuthKnobs): Promise<AuthSurface> {
    const store = await startStore(session.fork('store'), {
      fabric: knobs.fabric,
      enableDev: knobs.enableDev,
      enableGoogle: knobs.enableGoogle,
    });
    const clients = new Map(
      range(knobs.clientCount).map((i) => [`c${i}`, startActor()] as const)
    );
    return {
      session,
      store,
      clients,
      fingerprint: null,
      lastStatus: null,
    };
  },
});

const { defineAction, defineProperty } = auth;

export function caps(s: AuthSurface): string[] {
  return [...s.session.caps];
}

export function clientIds(s: AuthSurface): string[] {
  return [...s.clients.keys()];
}

export function fabric(s: AuthSurface): AuthFabric {
  return s.store.fabric;
}

export function bearers(s: AuthSurface): string[] {
  return [...s.clients.entries()].map(([id, a]) => `${id}:${a.bearer ?? ''}`);
}

/** Per-client bearer token (null when signed out). */
export function clientBearers(s: AuthSurface): Record<string, string | null> {
  return Object.fromEntries(
    [...s.clients.entries()].map(([id, a]) => [id, a.bearer])
  );
}

/** Verified session behind a bearer — null when expired / revoked / unknown. */
export async function sessionUser(
  s: AuthSurface,
  bearer: string
): Promise<{ externalUserId: string } | null> {
  const verified = await s.store.server.verifySessionToken(bearer);
  return verified === null ? null : { externalUserId: verified.externalUserId };
}

/** Canonical IdP dump — the determinism fingerprint. */
export async function storeFingerprint(s: AuthSurface): Promise<string> {
  return authFingerprint(s);
}

export function lastStatus(s: AuthSurface): number | null {
  return s.lastStatus;
}

export async function invariantViolations(s: AuthSurface): Promise<string[]> {
  try {
    await assertAuthInvariants(s);
    return [];
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
}

export const advanceClock = defineAction({
  name: 'advanceClock',
  enabled: (s) => caps(s).includes('virtualTime'),
  args: (_s) => gen(fc.constantFrom(1_000, AUTH_SESSION_TTL_MS + 1)),
  act: async (s, ms: number) => {
    await s.session.elapse(ms);
  },
});

export const setGoogleFault = defineAction({
  name: 'setGoogleFault',
  args: (_s) => gen(fc.boolean()),
  act: (s, fault: boolean) => {
    s.store.sim.googleFault = fault;
  },
});

export type OauthStartArgs = {
  readonly clientId: string;
  readonly provider: OauthProvider;
  readonly callbackUrl: string;
};

export const oauthStart = defineAction({
  name: 'oauthStart',
  enabled: (s) => clientIds(s).length > 0,
  weight: 3,
  args: (s) =>
    gen(
      fc.record({
        clientId: fc.constantFrom(...clientIds(s)),
        provider: fc.constantFrom(...PROVIDERS),
        callbackUrl: fc.constantFrom(...CALLBACK_URLS),
      })
    ),
  act: async (s, args: OauthStartArgs) => {
    await dispatchOauthStart(s, args.clientId, args.provider, args.callbackUrl);
  },
});

export type OauthApproveArgs = {
  readonly clientId: string;
  readonly provider: OauthProvider;
  readonly subject: string;
};

export const oauthApprove = defineAction({
  name: 'oauthApprove',
  enabled: (s) => clientIds(s).length > 0,
  weight: 3,
  args: (s) =>
    gen(
      fc.record({
        clientId: fc.constantFrom(...clientIds(s)),
        provider: fc.constantFrom(...PROVIDERS),
        subject: fc.constantFrom(...SUBJECTS),
      })
    ),
  act: async (s, args: OauthApproveArgs) => {
    await dispatchOauthApprove(s, args.clientId, args.provider, args.subject);
  },
});

export const sessionExchange = defineAction({
  name: 'sessionExchange',
  enabled: (s) => clientIds(s).length > 0,
  weight: 3,
  args: (s) => gen(fc.constantFrom(...clientIds(s))),
  act: async (s, clientId: string) => {
    await dispatchSessionExchange(s, clientId);
  },
});

export const signOut = defineAction({
  name: 'signOut',
  enabled: (s) => clientIds(s).length > 0,
  weight: 3,
  args: (s) => gen(fc.constantFrom(...clientIds(s))),
  act: async (s, clientId: string) => {
    await dispatchSignOut(s, clientId);
  },
});

export const stealBearer = defineAction({
  name: 'stealBearer',
  enabled: (s) => clientIds(s).length > 0,
  weight: 3,
  args: (s) => gen(fc.constantFrom(...clientIds(s))),
  act: async (s, clientId: string) => {
    await dispatchStealBearer(s, clientId, clientId);
  },
});

export const AUTH_ACTIONS = [
  advanceClock,
  setGoogleFault,
  oauthStart,
  oauthApprove,
  sessionExchange,
  signOut,
  stealBearer,
];

/** Re-run the schema migration against the live store (idempotence pin). */
export const migrateSchema = defineAction({
  name: 'migrateSchema',
  act: async (s) => {
    await migrateAuthSchema(s.store.fabric, s.store.sql);
  },
});

export type FetchAuthArgs = {
  readonly path: string;
  readonly init?: RequestInit;
};

export const fetchAuth = defineAction({
  name: 'fetchAuth',
  act: async (s, req: FetchAuthArgs) => {
    const res = await s.store.fetch(req.path, req.init);
    s.lastStatus = res.status;
  },
});

export const invariantsHold = defineProperty({
  name: 'invariants',
  check: async (s) => {
    const v = await invariantViolations(s);
    if (v.length > 0) throw new Error(v[0]!);
  },
});

export const AUTH_PROPERTIES = [invariantsHold];

export const arbAuthKnobs = (): fc.Arbitrary<AuthKnobs> =>
  fc.record({
    fabric: fc.constantFrom<AuthFabric>('sqlite-mem', 'postgres-mem'),
    clientCount: fc.integer({ min: 1, max: 3 }),
    enableDev: fc.boolean(),
    enableGoogle: fc.boolean(),
  });

export type { AuthSurface };
