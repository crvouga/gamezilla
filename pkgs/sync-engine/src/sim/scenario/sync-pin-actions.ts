/**
 * Scripted-pin actions for `run.apply(action, ...args)`. Every argument is a
 * scripted draw, so a random `walk` / `check` campaign draws `undefined` and
 * the action reports itself disabled. Randomised coverage lives in
 * `createSyncActions` (`sync-actions.ts`). Network / fault / crash pins live
 * in `pin-chaos-actions.ts`.
 */

import { defineAction } from '@pkgs/dst';
import { unsafe } from '@pkgs/sql';

import type { Mutation } from '../../mutations/core/types';
import { pumpConverge } from '../kit-pump';
import type { AddClientArgs } from '../kit-types';
import { applyActionToShadow } from './action-shadow';
import type { SyncAction } from './actions';
import {
  driveToSettled,
  driveWhilePending,
  type PostRows,
  pin,
  requireClient,
  resolveMutation,
  SUBSCRIBE_ALL_BUDGET_MS,
  SYNC_STEP_MS,
  subscriptionKey,
  subscriptions,
} from './pin-support';
import { prepareClientsForConverge, replayStep, resetClockSkews } from './play';
import { passTime } from './sync-actions';
import type { SyncSurface } from './system';

export {
  addPeerEngine,
  armStoragePressure,
  auth,
  brokerCrash,
  brokerRestart,
  clearStoragePressure,
  crash,
  crashAt,
  failNextOpen,
  heal,
  hold,
  httpFault,
  net,
  netSet,
  partition,
  publishFault,
  pubsubFault,
  release,
  restart,
  restartWithSchema,
  serverOp,
  serverPrune,
  skewClock,
  tamperLocalStorage,
} from './pin-chaos-actions';
/** `passTime` is already draw-shaped: `run.apply(passTime, 500)`. */
export { passTime, SYNC_STEP_MS };

import {
  addPeerEngine,
  armStoragePressure,
  auth,
  brokerCrash,
  brokerRestart,
  clearStoragePressure,
  crash,
  crashAt,
  failNextOpen,
  heal,
  hold,
  httpFault,
  net,
  partition,
  publishFault,
  pubsubFault,
  release,
  restart,
  restartWithSchema,
  serverOp,
  serverPrune,
  skewClock,
  tamperLocalStorage,
} from './pin-chaos-actions';

/** `run.apply(addClient, 'alice')` or `run.apply(addClient, { id, actorId })`. */
export const addClient = defineAction({
  name: 'addClient',
  *generate() {
    const arg = yield* pin<string | AddClientArgs>();
    if (arg === undefined) return;
    const args: AddClientArgs =
      typeof arg === 'string' ? { id: arg, actorId: arg } : arg;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await s.addClient(args);
      },
    };
  },
});

/**
 * `run.apply(mutate, 'bob', setNote, { id: 'n1' })`. The result is recorded on
 * the run so `lastMutationId('bob')` / `lastMutationOk('bob')` can read it.
 */
export const mutate = defineAction({
  name: 'mutate',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const named = yield* pin<Mutation<unknown> | string>();
    if (named === undefined) return;
    const args = yield* pin<unknown>();
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const mutation = resolveMutation(s, named);
        const result = await requireClient(s, clientId).mutate(mutation, args);
        s.runtime.lastMutation.set(
          clientId,
          result.ok
            ? { ok: true, mutationId: result.mutationId, failures: [] }
            : { ok: false, mutationId: null, failures: result.failures }
        );
      },
    };
  },
});

export const connect = defineAction({
  name: 'connect',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await requireClient(s, clientId).connect();
      },
    };
  },
});

export const disconnect = defineAction({
  name: 'disconnect',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await requireClient(s, clientId).disconnect();
      },
    };
  },
});

export const online = defineAction({
  name: 'online',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const value = yield* pin<boolean>();
    if (value === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        requireClient(s, clientId).online(value);
      },
    };
  },
});

export const foreground = defineAction({
  name: 'foreground',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const value = yield* pin<boolean>();
    if (value === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        requireClient(s, clientId).foreground(value);
      },
    };
  },
});

export const clearLocalData = defineAction({
  name: 'clearLocalData',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const reason = yield* pin<string>();
    if (reason === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await requireClient(s, clientId).clearLocalData(reason);
      },
    };
  },
});

export const nudge = defineAction({
  name: 'nudge',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const client = requireClient(s, clientId);
        // A nudge issued while sync is held never resolves — drive it as far as
        // virtual time allows and leave the wake in flight.
        await driveWhilePending(s, () => client.nudge());
      },
    };
  },
});

export const subscribe = defineAction({
  name: 'subscribe',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const queryName = yield* pin<string>();
    if (queryName === undefined) return;
    const params = yield* pin<Record<string, unknown>>();
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const sub = requireClient(s, clientId).subscribe(
          queryName,
          params ?? {}
        );
        subscriptions(s).set(subscriptionKey(clientId, queryName), sub);
        await driveToSettled(
          s,
          `subscribe:${clientId}:${queryName}`,
          () => sub.ready
        );
      },
    };
  },
});

/**
 * Open every scope in `paramsList` before waiting on any of them, so the engine
 * batches them into one query POST. Use when the scope count itself is the
 * subject (batch bounds / chunking); prefer {@link subscribe} otherwise.
 */
export const subscribeAll = defineAction({
  name: 'subscribeAll',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const queryName = yield* pin<string>();
    if (queryName === undefined) return;
    const paramsList = yield* pin<readonly Record<string, unknown>[]>();
    if (paramsList === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const client = requireClient(s, clientId);
        const bag = subscriptions(s);
        const opened = paramsList.map((params, i) => {
          const sub = client.subscribe(queryName, params);
          bag.set(`${subscriptionKey(clientId, queryName)}:${String(i)}`, sub);
          return sub;
        });
        await driveToSettled(
          s,
          `subscribeAll:${clientId}:${queryName}`,
          () => Promise.all(opened.map((sub) => sub.ready)),
          SUBSCRIBE_ALL_BUDGET_MS
        );
      },
    };
  },
});

export const unsubscribe = defineAction({
  name: 'unsubscribe',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const queryName = yield* pin<string>();
    if (queryName === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        const key = subscriptionKey(clientId, queryName);
        const bag = subscriptions(s);
        bag.get(key)?.[Symbol.dispose]();
        bag.delete(key);
      },
    };
  },
});

function recordPost(s: SyncSurface, clientId: string, rows: PostRows): void {
  s.runtime.lastPost.delete(clientId);
  void requireClient(s, clientId)
    .postMutations(rows)
    .then(
      (res: {
        ok: boolean;
        verdicts: readonly { mutationId: string; status: string }[];
      }) => {
        s.runtime.lastPost.set(clientId, {
          ok: res.ok,
          verdicts: res.verdicts.map((v) => ({
            mutationId: v.mutationId,
            status: v.status,
          })),
        });
      },
      (e: unknown) => {
        s.runtime.lastPost.set(clientId, {
          ok: false,
          verdicts: [],
          error: e instanceof Error ? e.message : String(e),
        });
      }
    );
}

export const postMutations = defineAction({
  name: 'postMutations',
  *generate() {
    const clientId = yield* pin<string>();
    if (clientId === undefined) return;
    const rows = yield* pin<PostRows>();
    if (rows === undefined) return;
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        recordPost(s, clientId, rows);
      },
    };
  },
});

/**
 * Replay wire rows straight at the server handler while impersonating
 * `actorId` — a hostile or late re-POST that never went through a client
 * engine. The verdicts land on `postOutcome(actorId)`.
 */
export const serverReplay = defineAction({
  name: 'serverReplay',
  *generate() {
    const actorId = yield* pin<string>();
    if (actorId === undefined) return;
    const rows = yield* pin<PostRows>();
    if (rows === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const first = rows[0];
        if (first === undefined) return;
        s.server.setAuth({
          actorId,
          deviceId: first.clientId,
          accountId: `acct:${actorId}`,
          isAnon: false,
        });
        const result = await s.server.handlers.handleMutations(rows);
        s.runtime.lastPost.set(actorId, {
          ok: result.ok,
          verdicts: result.verdicts.map((v) => ({
            mutationId: v.mutationId,
            status: v.status,
          })),
        });
      },
    };
  },
});

export const execSql = defineAction({
  name: 'execSql',
  *generate() {
    const nodeId = yield* pin<string>();
    if (nodeId === undefined) return;
    const statement = yield* pin<string>();
    if (statement === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        const db =
          nodeId === 'server' ? s.server.db : requireClient(s, nodeId).db;
        await db.run(unsafe(statement));
      },
    };
  },
});

export const runSql = execSql;

export const playActions = defineAction({
  name: 'playActions',
  *generate() {
    const actions = yield* pin<readonly SyncAction[]>();
    if (actions === undefined) return;
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        for (const action of actions) {
          await replayStep({
            surface: s,
            app: s.runtime.app,
            action,
            state: s.runtime.replay,
          });
          applyActionToShadow(s.runtime.app, s.shadow, action);
          await s.checkInvariants();
          await s.advance(SYNC_STEP_MS);
        }
      },
    };
  },
});

/**
 * Heal owed clients, clear faults, reconnect — stimulus only. Pair with
 * `untilObserved(run, converged, passTime)` (or {@link expectConverged}).
 */
export const revive = defineAction({
  name: 'revive',
  *generate() {
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await prepareClientsForConverge(s.runtime.app, s, s.runtime.replay);
        resetClockSkews(s);
        await s.revive();
      },
    };
  },
});

/** Wake uploads / refresh on every live client — stimulus for drain waits. */
export const wakeAll = defineAction({
  name: 'wakeAll',
  *generate() {
    yield {
      weight: 1,
      act: (s: SyncSurface) => {
        for (const client of s.clients.values()) {
          client.engine.wakeUploads();
          void client.engine.refreshQueries().catch(() => undefined);
        }
      },
    };
  },
});

/**
 * One converge pump: wake + drain scheduler (stimulus only).
 * Pair with `untilObserved(converged)` / {@link expectConverged}.
 */
export const pump = defineAction({
  name: 'pump',
  *generate() {
    yield {
      weight: 1,
      act: async (s: SyncSurface) => {
        await pumpConverge(s);
      },
    };
  },
});

/** Every scripted pin, for callers that need the whole vocabulary. */
export const SYNC_PIN_ACTIONS = [
  addClient,
  mutate,
  connect,
  disconnect,
  online,
  foreground,
  clearLocalData,
  nudge,
  subscribe,
  subscribeAll,
  unsubscribe,
  postMutations,
  serverReplay,
  execSql,
  runSql,
  playActions,
  passTime,
  revive,
  wakeAll,
  pump,
  net,
  hold,
  release,
  partition,
  heal,
  crash,
  crashAt,
  restart,
  restartWithSchema,
  skewClock,
  httpFault,
  publishFault,
  pubsubFault,
  brokerCrash,
  brokerRestart,
  armStoragePressure,
  clearStoragePressure,
  tamperLocalStorage,
  failNextOpen,
  serverPrune,
  addPeerEngine,
  serverOp,
  auth,
] as const;
