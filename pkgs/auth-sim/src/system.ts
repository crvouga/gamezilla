import {
  defineProperty,
  defineRuntime,
  defineSystem,
  virtualTimeRuntime,
} from '@pkgs/sim';
import { gen } from '@pkgs/sim/fast-check';
import fc from 'fast-check';

import { AUTH_ACTIONS } from './actions';
import { startActor } from './actor';
import { sessionUserOf } from './checks';
import { DIRECTORIES } from './idp-node';
import { authFingerprint, authInvariantViolations } from './invariants';
import { createAuthModel } from './model';
import { startStore } from './nodes';
import type { ActorState, AuthFabric, AuthSurface } from './types';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** Typed topology for one auth run. */
export type AuthArgs = {
  readonly fabric: AuthFabric;
  readonly clientCount: number;
};

/** mockingbird-sqlite, two devices. */
export const AUTH_ARGS: AuthArgs = {
  fabric: 'mockingbird-sqlite',
  clientCount: 2,
};

export const arbAuthArgs = (): fc.Arbitrary<AuthArgs> =>
  fc.record({
    fabric: fc.constantFrom<AuthFabric>(
      'mockingbird-sqlite',
      'mockingbird-postgres'
    ),
    clientCount: fc.integer({ min: 1, max: 3 }),
  });

export function caps(s: AuthSurface): string[] {
  return [...s.session.caps];
}

export function fabric(s: AuthSurface): AuthFabric {
  return s.store.fabric;
}

/** Per-device bearer (null when signed out on that device). */
export async function clientBearers(
  s: AuthSurface
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const [id, actor] of s.clients) out[id] = await actor.bearerStore.read();
  return out;
}

/** The user a device is signed in as, per the store (null when none). */
export async function signedInUser(
  s: AuthSurface,
  clientId: string
): Promise<string | null> {
  const actor = s.clients.get(clientId);
  return actor === undefined ? null : await sessionUserOf(s, actor);
}

/** Verified session behind a bearer — null when expired / revoked / unknown. */
export async function sessionUser(
  s: AuthSurface,
  bearer: string
): Promise<{ externalUserId: string } | null> {
  const verified = await s.store.server.verifySessionToken(bearer);
  return verified === null ? null : { externalUserId: verified.externalUserId };
}

/** Flow coverage: how often each predicted outcome was observed. */
export function outcomeCounts(s: AuthSurface): Record<string, number> {
  return { ...s.outcomes };
}

/** How the device's last auth step ended. */
export function lastOutcome(s: AuthSurface, clientId: string) {
  return s.clients.get(clientId)?.last ?? null;
}

/** The sign-in methods on the device's account, as the client lists them. */
export async function identitiesOf(s: AuthSurface, clientId: string) {
  const actor = s.clients.get(clientId);
  if (actor === undefined) return [];
  return await actor.port.listIdentities().catch(() => []);
}

/** Canonical store dump — the determinism fingerprint. */
export async function storeFingerprint(s: AuthSurface): Promise<string> {
  return authFingerprint(s);
}

export function lastStatus(s: AuthSurface): number | null {
  return s.lastStatus;
}

export async function invariantViolations(s: AuthSurface): Promise<string[]> {
  return await authInvariantViolations(s);
}

export const invariantsHold = defineProperty({
  name: 'invariants',
  check: async (s: AuthSurface) => {
    const violations = await authInvariantViolations(s);
    if (violations.length > 0) throw new Error(violations.join('\n'));
  },
});

/**
 * One auth app over mockingbird-sqlite / mockingbird-postgres, a Google-flavored and an
 * Apple-flavored provider, and `clientCount` devices running the production
 * client port.
 */
export const auth = defineSystem<AuthSurface, AuthArgs>({
  name: 'auth.idp',
  args: AUTH_ARGS,
  sample: () => gen(arbAuthArgs()),
  async create(session, args): Promise<AuthSurface> {
    const store = await startStore(session.fork('store'), {
      fabric: args.fabric,
    });
    const clients = new Map<string, ActorState>(
      range(args.clientCount).map((i) => {
        const id = `c${String(i)}`;
        return [id, startActor({ id, store, session: session.fork(id) })];
      })
    );
    return {
      session,
      store,
      clients,
      model: createAuthModel(),
      violations: [],
      outcomes: {},
      directory: {
        google: DIRECTORIES.google.map((draft) =>
          emailOfDraft(draft, 'gmail.com')
        ),
        apple: DIRECTORIES.apple.map((draft) =>
          emailOfDraft(draft, 'icloud.com')
        ),
      },
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
  actions: [...AUTH_ACTIONS],
  properties: [invariantsHold],
});

function emailOfDraft(
  draft: { readonly handle?: string; readonly email?: string },
  domain: string
): string {
  return draft.email ?? `${draft.handle ?? ''}@${domain}`;
}

export type { AuthSurface };
