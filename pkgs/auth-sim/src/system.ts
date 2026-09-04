import {
  AUTH_SESSION_TTL_MS,
  IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '@pkgs/auth/shared/auth-constants';
import {
  defineAction,
  defineProperty,
  defineRuntime,
  defineSystem,
  virtualTimeRuntime,
} from '@pkgs/sim';
import { gen } from '@pkgs/sim/fast-check';
import fc from 'fast-check';
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

/** Typed topology for one IdP script. */
export type AuthArgs = {
  readonly fabric: AuthFabric;
  readonly clientCount: number;
  readonly enableDev: boolean;
  readonly enableGoogle: boolean;
};

/** sqlite-mem, two clients, both providers on. */
export const AUTH_ARGS: AuthArgs = {
  fabric: 'sqlite-mem',
  clientCount: 2,
  enableDev: true,
  enableGoogle: true,
};

export const arbAuthArgs = (): fc.Arbitrary<AuthArgs> =>
  fc.record({
    fabric: fc.constantFrom<AuthFabric>('sqlite-mem', 'postgres-mem'),
    clientCount: fc.integer({ min: 1, max: 3 }),
    enableDev: fc.boolean(),
    enableGoogle: fc.boolean(),
  });

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
  enabled: (s: AuthSurface) => caps(s).includes('virtualTime'),
  sample: () => gen(fc.constantFrom(1_000, AUTH_SESSION_TTL_MS + 1)),
  act: async (s: AuthSurface, ms: number) => {
    await s.session.advanceTime(ms);
  },
});

export const setGoogleFault = defineAction({
  name: 'setGoogleFault',
  sample: () => gen(fc.boolean()),
  act: (s: AuthSurface, fault: boolean) => {
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
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  weight: 3,
  sample: (s: AuthSurface) =>
    gen(
      fc.record({
        clientId: fc.constantFrom(...clientIds(s)),
        provider: fc.constantFrom(...PROVIDERS),
        callbackUrl: fc.constantFrom(...CALLBACK_URLS),
      })
    ),
  act: async (s: AuthSurface, args: OauthStartArgs) => {
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
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  weight: 3,
  sample: (s: AuthSurface) =>
    gen(
      fc.record({
        clientId: fc.constantFrom(...clientIds(s)),
        provider: fc.constantFrom(...PROVIDERS),
        subject: fc.constantFrom(...SUBJECTS),
      })
    ),
  act: async (s: AuthSurface, args: OauthApproveArgs) => {
    await dispatchOauthApprove(s, args.clientId, args.provider, args.subject);
  },
});

export const sessionExchange = defineAction({
  name: 'sessionExchange',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  weight: 3,
  sample: (s: AuthSurface) => gen(fc.constantFrom(...clientIds(s))),
  act: async (s: AuthSurface, clientId: string) => {
    await dispatchSessionExchange(s, clientId);
  },
});

export const signOut = defineAction({
  name: 'signOut',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  weight: 3,
  sample: (s: AuthSurface) => gen(fc.constantFrom(...clientIds(s))),
  act: async (s: AuthSurface, clientId: string) => {
    await dispatchSignOut(s, clientId);
  },
});

export const stealBearer = defineAction({
  name: 'stealBearer',
  enabled: (s: AuthSurface) => clientIds(s).length > 0,
  weight: 3,
  sample: (s: AuthSurface) => gen(fc.constantFrom(...clientIds(s))),
  act: async (s: AuthSurface, clientId: string) => {
    await dispatchStealBearer(s, clientId, clientId);
  },
});

/** Re-run the schema migration against the live store (idempotence pin). */
export const migrateSchema = defineAction({
  name: 'migrateSchema',
  act: async (s: AuthSurface) => {
    await migrateAuthSchema(s.store.fabric, s.store.sql);
  },
});

export type FetchAuthArgs = {
  readonly path: string;
  readonly init?: RequestInit;
};

export const fetchAuth = defineAction({
  name: 'fetchAuth',
  act: async (s: AuthSurface, req: FetchAuthArgs) => {
    const res = await s.store.fetch(req.path, req.init);
    s.lastStatus = res.status;
  },
});

export const invariantsHold = defineProperty({
  name: 'invariants',
  check: async (s: AuthSurface) => {
    const v = await invariantViolations(s);
    if (v.length > 0) throw new Error(v[0]!);
  },
});

/** One IdP store (sqlite-mem / postgres-mem) plus `clientCount` actors. */
export const auth = defineSystem<AuthSurface, AuthArgs>({
  name: 'auth.idp',
  args: AUTH_ARGS,
  sample: () => gen(arbAuthArgs()),
  async create(session, args): Promise<AuthSurface> {
    const store = await startStore(session.fork('store'), {
      fabric: args.fabric,
      enableDev: args.enableDev,
      enableGoogle: args.enableGoogle,
    });
    const clients = new Map(
      range(args.clientCount).map((i) => [`c${i}`, startActor()] as const)
    );
    return {
      session,
      store,
      clients,
      fingerprint: null,
      lastStatus: null,
    };
  },
  runtimes: [
    defineRuntime({
      default: true,
      name: 'virtual',
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [
    advanceClock,
    setGoogleFault,
    oauthStart,
    oauthApprove,
    sessionExchange,
    signOut,
    stealBearer,
    migrateSchema,
    fetchAuth,
  ],
  properties: [invariantsHold],
});

export type { AuthSurface };
