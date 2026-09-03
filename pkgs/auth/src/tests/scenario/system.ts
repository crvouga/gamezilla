import { defineSystem, draw } from '@pkgs/dst';
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

const { defineObservation, defineAction, defineProperty } = auth;

export const caps = defineObservation({
  name: 'caps',
  observe: (s) => [...s.session.caps] as string[],
});

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s) => [...s.clients.keys()],
});

export const fabric = defineObservation({
  name: 'fabric',
  observe: (s) => s.store.fabric,
});

export const bearers = defineObservation({
  name: 'bearers',
  observe: (s) =>
    [...s.clients.entries()].map(([id, a]) => `${id}:${a.bearer ?? ''}`),
});

/** Per-client bearer token (null when signed out). */
export const clientBearers = defineObservation({
  name: 'clientBearers',
  observe: (s) =>
    Object.fromEntries(
      [...s.clients.entries()].map(([id, a]) => [id, a.bearer])
    ) as Record<string, string | null>,
});

/** Verified session behind a bearer — null when expired / revoked / unknown. */
export const sessionUser = defineObservation({
  name: 'sessionUser',
  observe: async (s, bearer: string) => {
    const verified = await s.store.server.verifySessionToken(bearer);
    return verified === null
      ? null
      : { externalUserId: verified.externalUserId };
  },
});

/** Canonical IdP dump — the determinism fingerprint. */
export const storeFingerprint = defineObservation({
  name: 'storeFingerprint',
  observe: (s) => authFingerprint(s),
});

export const lastStatus = defineObservation({
  name: 'lastStatus',
  observe: (s): number | null => s.lastStatus,
});

export const invariantViolations = defineObservation({
  name: 'invariantViolations',
  observe: async (s) => {
    try {
      await assertAuthInvariants(s);
      return [] as string[];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  },
});

export const advanceClock = defineAction({
  name: 'advanceClock',
  generate(ms: number) {
    return (s) => s.session.scheduler.advance(ms);
  },
});

export const randomAdvanceClock = defineAction({
  name: 'randomAdvanceClock',
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw(
      gen(fc.constantFrom(1_000, AUTH_SESSION_TTL_MS + 1))
    );
    yield* advanceClock(ms);
  },
});

export const setGoogleFault = defineAction({
  name: 'setGoogleFault',
  generate(fault: boolean) {
    return (s) => {
      s.store.sim.googleFault = fault;
    };
  },
});

export const randomSetGoogleFault = defineAction({
  name: 'randomSetGoogleFault',
  *generate() {
    const fault = yield* draw(gen(fc.boolean()));
    yield* setGoogleFault(fault);
  },
});

export type OauthStartArgs = {
  readonly clientId: string;
  readonly provider: OauthProvider;
  readonly callbackUrl: string;
};

export const oauthStart = defineAction({
  name: 'oauthStart',
  generate(args: OauthStartArgs) {
    return (s) =>
      dispatchOauthStart(s, args.clientId, args.provider, args.callbackUrl);
  },
});

export const randomOauthStart = defineAction({
  name: 'randomOauthStart',
  *generate() {
    const ids = yield* clientIds;
    if (ids.length === 0) return;
    const payload = yield* draw(
      gen(
        fc.record({
          clientId: fc.constantFrom(...(ids as string[])),
          provider: fc.constantFrom(...PROVIDERS),
          callbackUrl: fc.constantFrom(...CALLBACK_URLS),
        })
      )
    );
    yield {
      weight: 3,
      act: (s: AuthSurface) =>
        dispatchOauthStart(
          s,
          payload.clientId,
          payload.provider as OauthProvider,
          payload.callbackUrl
        ),
    };
  },
});

export type OauthApproveArgs = {
  readonly clientId: string;
  readonly provider: OauthProvider;
  readonly subject: string;
};

export const oauthApprove = defineAction({
  name: 'oauthApprove',
  generate(args: OauthApproveArgs) {
    return (s) =>
      dispatchOauthApprove(s, args.clientId, args.provider, args.subject);
  },
});

export const randomOauthApprove = defineAction({
  name: 'randomOauthApprove',
  *generate() {
    const ids = yield* clientIds;
    if (ids.length === 0) return;
    const payload = yield* draw(
      gen(
        fc.record({
          clientId: fc.constantFrom(...(ids as string[])),
          provider: fc.constantFrom(...PROVIDERS),
          subject: fc.constantFrom(...SUBJECTS),
        })
      )
    );
    yield {
      weight: 3,
      act: (s: AuthSurface) =>
        dispatchOauthApprove(
          s,
          payload.clientId,
          payload.provider as OauthProvider,
          payload.subject
        ),
    };
  },
});

export const sessionExchange = defineAction({
  name: 'sessionExchange',
  generate(clientId: string) {
    return (s) => dispatchSessionExchange(s, clientId);
  },
});

export const randomSessionExchange = defineAction({
  name: 'randomSessionExchange',
  *generate() {
    const ids = yield* clientIds;
    if (ids.length === 0) return;
    const clientId = yield* draw(gen(fc.constantFrom(...(ids as string[]))));
    yield {
      weight: 3,
      act: (s: AuthSurface) => dispatchSessionExchange(s, clientId),
    };
  },
});

export const signOut = defineAction({
  name: 'signOut',
  generate(clientId: string) {
    return (s) => dispatchSignOut(s, clientId);
  },
});

export const randomSignOut = defineAction({
  name: 'randomSignOut',
  *generate() {
    const ids = yield* clientIds;
    if (ids.length === 0) return;
    const clientId = yield* draw(gen(fc.constantFrom(...(ids as string[]))));
    yield {
      weight: 3,
      act: (s: AuthSurface) => dispatchSignOut(s, clientId),
    };
  },
});

export const stealBearer = defineAction({
  name: 'stealBearer',
  *generate() {
    const ids = yield* clientIds;
    if (ids.length === 0) return;
    const clientId = yield* draw(gen(fc.constantFrom(...(ids as string[]))));
    yield {
      weight: 3,
      act: (s: AuthSurface) => dispatchStealBearer(s, clientId, clientId),
    };
  },
});

export const AUTH_ACTIONS = [
  randomAdvanceClock,
  randomSetGoogleFault,
  randomOauthStart,
  randomOauthApprove,
  randomSessionExchange,
  randomSignOut,
  stealBearer,
];

/** Re-run the schema migration against the live store (idempotence pin). */
export const migrateSchema = defineAction({
  name: 'migrateSchema',
  generate() {
    return async (s) => {
      await migrateAuthSchema(s.store.fabric, s.store.sql);
    };
  },
});

export type FetchAuthArgs = {
  readonly path: string;
  readonly init?: RequestInit;
};

export const fetchAuth = defineAction({
  name: 'fetchAuth',
  generate(req: FetchAuthArgs) {
    return async (s) => {
      const res = await s.store.fetch(req.path, req.init);
      s.lastStatus = res.status;
    };
  },
});

export const invariantsHold = defineProperty({
  name: 'invariants',
  *watch() {
    const v = yield* invariantViolations;
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
