import { defineProperty } from '@pkgs/harness-shared/define-property';
import { defineRuntime } from '@pkgs/harness-shared/define-runtime';
import { defineSystem } from '@pkgs/harness-shared/define-system';
import { virtualTimeRuntime } from '@pkgs/harness-shared/virtual-time-runtime';
import { gen } from '@pkgs/harness-shared/fast-check';
import sql from '@pkgs/sql-shared/sql';
import fc from 'fast-check';

import { AUTH_ACTIONS } from './actions';
import { startActor } from './actor';
import { sessionUserOf } from './checks';
import { DIRECTORIES, emailOfEntry } from './providers';
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

/** Whether the device is being asked to prove an address match. */
export function awaitingProof(s: AuthSurface, clientId: string): boolean {
  return (s.clients.get(clientId)?.pendingLink ?? null) !== null;
}

/** One account on record and the outside accounts that get into it. */
export type AccountOnRecord = {
  readonly id: string;
  readonly methods: readonly {
    readonly provider: string;
    readonly email: string | null;
  }[];
};

/**
 * Every account on record, oldest first, with its sign-in methods — what
 * each account holder's own devices list, read without needing any device
 * to be online.
 */
export async function accountsOnRecord(
  s: AuthSurface
): Promise<AccountOnRecord[]> {
  const users = await s.store.sql.query(sql<{ id: string }>`
    SELECT id FROM idp_users ORDER BY created_at, id
  `);
  const rows = await s.store.sql.query(sql<{
    user_id: string;
    provider: string;
    email: string | null;
  }>`
    SELECT user_id, provider, email FROM idp_accounts
    ORDER BY provider, provider_user_id
  `);
  return users.map(({ id }) => ({
    id,
    methods: rows
      .filter((row) => row.user_id === id)
      .map(({ provider, email }) => ({ provider, email })),
  }));
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
        google: DIRECTORIES.google.map((entry) =>
          emailOfEntry(entry, 'google')
        ),
        apple: DIRECTORIES.apple.map((entry) => emailOfEntry(entry, 'apple')),
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
