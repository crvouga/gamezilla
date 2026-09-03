/**
 * Pool actions for the account-switch scenario. `createSyncEnginePool` hands
 * back live `SyncEngine` objects, which no observation may return — so the
 * identity comparison happens inside the action and the run only ever sees the
 * boolean verdict.
 */

import { defineAction, defineObservation, draw } from '@pkgs/dst';

import type { SyncEnginePoolApi } from '../../../client/sync-engine-pool';
import type { SyncSurface } from '../../../sim/scenario';

/** One `getOrCreate` call: which identity, and which client owns the engine. */
export type PoolActivation = {
  readonly identity: string;
  readonly clientId: string;
};

type Verdicts = {
  readonly matched: Map<string, boolean>;
  overlappingCreates: number;
};

const verdictsBySurface = new WeakMap<SyncSurface, Verdicts>();

function verdicts(s: SyncSurface): Verdicts {
  const existing = verdictsBySurface.get(s);
  if (existing !== undefined) return existing;
  const next: Verdicts = { matched: new Map(), overlappingCreates: 0 };
  verdictsBySurface.set(s, next);
  return next;
}

function engineOf(s: SyncSurface, clientId: string) {
  const client = s.clients.get(clientId);
  if (client === undefined) {
    throw new Error(`pool action: unknown client '${clientId}'`);
  }
  return client.getSyncEngine();
}

function pin<T>() {
  return draw<T | undefined>(() => undefined);
}

/**
 * `run.apply(poolActivate, pool, { identity: 'user-a', clientId: 'device-a' })`
 * — activate one identity and record whether the pool returned that client's
 * own engine.
 */
export const poolActivate = defineAction({
  name: 'poolActivate',
  *generate() {
    const pool = yield* pin<SyncEnginePoolApi>();
    if (pool === undefined) return;
    const activation = yield* pin<PoolActivation>();
    if (activation === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const engine = await pool.getOrCreate(activation.identity, async () =>
          engineOf(s, activation.clientId)
        );
        verdicts(s).matched.set(
          activation.identity,
          engine === engineOf(s, activation.clientId)
        );
      },
    };
  },
});

/**
 * Activate several identities concurrently through a deliberately slow create,
 * so an unserialized pool would overlap them.
 */
export const poolActivateConcurrently = defineAction({
  name: 'poolActivateConcurrently',
  *generate() {
    const pool = yield* pin<SyncEnginePoolApi>();
    if (pool === undefined) return;
    const activations = yield* pin<readonly PoolActivation[]>();
    if (activations === undefined) return;
    const delayMs = yield* pin<number>();
    if (delayMs === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
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
    };
  },
});

/** True when the pool handed back that client's own engine for an identity. */
export function poolMatched(identity: string) {
  return defineObservation({
    name: `poolMatched:${identity}`,
    observe: (s: SyncSurface): boolean =>
      verdicts(s).matched.get(identity) ?? false,
  });
}

/** How many creates ever ran concurrently — a serialized pool keeps this at 0. */
export const poolOverlappingCreates = defineObservation({
  name: 'poolOverlappingCreates',
  observe: (s: SyncSurface): number => verdicts(s).overlappingCreates,
});
