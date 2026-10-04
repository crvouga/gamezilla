/**
 * Pool actions for the account-switch scenario. `createSyncEnginePool` hands
 * back live `SyncEngine` objects, which no read may return — so the
 * identity comparison happens inside the action and the run only ever sees the
 * boolean verdict.
 */

import { defineAction } from '@pkgs/harness-root-shared/define-action';

import type { SyncEnginePoolApi } from '@pkgs/sync-engine-client/sync-engine-pool';
import type { SyncHarness } from './scenario-system';

/** One `getOrCreate` call: which identity, and which client owns the engine. */
export type PoolActivation = {
  readonly identity: string;
  readonly clientId: string;
};

type Verdicts = {
  readonly matched: Map<string, boolean>;
  overlappingCreates: number;
};

const verdictsBySurface = new WeakMap<SyncHarness, Verdicts>();

function verdicts(s: SyncHarness): Verdicts {
  const existing = verdictsBySurface.get(s);
  if (existing !== undefined) return existing;
  const next: Verdicts = { matched: new Map(), overlappingCreates: 0 };
  verdictsBySurface.set(s, next);
  return next;
}

function engineOf(s: SyncHarness, clientId: string) {
  const client = s.clients.get(clientId);
  if (client === undefined) {
    throw new Error(`pool action: unknown client '${clientId}'`);
  }
  return client.getSyncEngine();
}

/**
 * `s.apply(poolActivate, pool, { identity: 'user-a', clientId: 'device-a' })`
 * — activate one identity and record whether the pool returned that client's
 * own engine.
 */
export const poolActivate = defineAction({
  name: 'poolActivate',
  act: async (
    s: SyncHarness,
    pool: SyncEnginePoolApi,
    activation: PoolActivation
  ) => {
    const engine = await pool.getOrCreate(activation.identity, async () =>
      engineOf(s, activation.clientId)
    );
    verdicts(s).matched.set(
      activation.identity,
      engine === engineOf(s, activation.clientId)
    );
  },
});

/**
 * Activate several identities concurrently through a deliberately slow create,
 * so an unserialized pool would overlap them.
 */
export const poolActivateConcurrently = defineAction({
  name: 'poolActivateConcurrently',
  act: async (
    s: SyncHarness,
    pool: SyncEnginePoolApi,
    activations: readonly PoolActivation[],
    delayMs: number
  ) => {
    const bag = verdicts(s);
    let inFlight = 0;
    await Promise.all(
      activations.map(async (activation) =>
        pool.getOrCreate(activation.identity, async () => {
          inFlight += 1;
          if (inFlight > 1) bag.overlappingCreates += 1;
          await s.advance(delayMs);
          inFlight -= 1;
          return engineOf(s, activation.clientId);
        })
      )
    );
    for (const activation of activations) {
      const ready = pool.peekReady(activation.identity);
      bag.matched.set(
        activation.identity,
        ready === null || ready === engineOf(s, activation.clientId)
      );
    }
  },
});

/** True when the pool handed back that client's own engine for an identity. */
export function poolMatched(s: SyncHarness, identity: string): boolean {
  return verdicts(s).matched.get(identity) ?? false;
}

/** How many creates ever ran concurrently — a serialized pool keeps this at 0. */
export function poolOverlappingCreates(s: SyncHarness): number {
  return verdicts(s).overlappingCreates;
}
