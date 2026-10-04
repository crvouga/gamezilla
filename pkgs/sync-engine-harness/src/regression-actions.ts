/**
 * Scripted-pin actions for `s.apply(action, ...args)`. Typed act
 * parameters replace the old `pin()` draws. Randomised coverage lives in
 * the `pool` catalog (`sync-actions.ts`). Network / fault / crash pins live
 * in `regression-random-faults-actions.ts`.
 */

import { defineAction } from '@pkgs/harness-shared/define-action';
import { unsafe } from '@pkgs/sql-shared/sql';

import type { Mutation } from '@pkgs/sync-engine-shared/mutations-types';
import { pumpInSync } from './pump';
import type { StoragePressureKind } from './storage-pressure';
import type { AddClientArgs } from './types';
import { prepareClientsForInSync, resetClockSkews } from './pool-support';
import { driveToSettled, driveWhilePending, requireClient, resolveMutation, SUBSCRIBE_ALL_BUDGET_MS, subscriptionKey, subscriptions } from './regression-support';
import type { PostRows } from './regression-support';
import type { SyncHarness } from './scenario-system';

/** `s.apply(addClient, 'alice')` or `s.apply(addClient, { id, actorId })`. */
export const addClient = defineAction({
  name: 'addClient',
  act: async (s: SyncHarness, arg: string | AddClientArgs) => {
    const args: AddClientArgs =
      typeof arg === 'string' ? { id: arg, actorId: arg } : arg;
    await s.addClient(args);
  },
});

/**
 * `s.apply(mutate, 'bob', setNote, { id: 'n1' })`. The result is recorded on
 * the run so `lastMutationId` / `lastMutationOk` can read it.
 */
export const mutate = defineAction({
  name: 'mutate',
  act: async (
    s: SyncHarness,
    clientId: string,
    named: Mutation<unknown> | string,
    args: unknown
  ) => {
    const mutation = resolveMutation(s, named);
    const result = await requireClient(s, clientId).mutate(mutation, args);
    s.runtime.lastMutation.set(
      clientId,
      result.ok
        ? { ok: true, mutationId: result.mutationId, failures: [] }
        : { ok: false, mutationId: null, failures: result.failures }
    );
  },
});

/**
 * `s.apply(mutateWhileFull, 'bob', { pressure: 'sqliteFull', mutation:
 * setNote, args: { id: 'n1' } })`: the device is too full to save at the
 * moment the person writes. The arm and the write happen in one step, so
 * nothing else consumes the arm; it is cleared after, whatever the write did.
 */
export const mutateWhileFull = defineAction({
  name: 'mutateWhileFull',
  act: async (
    s: SyncHarness,
    clientId: string,
    write: {
      readonly pressure: StoragePressureKind;
      readonly mutation: Mutation<unknown> | string;
      readonly args: unknown;
    }
  ) => {
    const mutation = resolveMutation(s, write.mutation);
    s.armStoragePressure(clientId, write.pressure);
    try {
      const result = await requireClient(s, clientId).mutate(
        mutation,
        write.args
      );
      s.runtime.lastMutation.set(
        clientId,
        result.ok
          ? { ok: true, mutationId: result.mutationId, failures: [] }
          : { ok: false, mutationId: null, failures: result.failures }
      );
    } finally {
      s.clearStoragePressure(clientId);
    }
  },
});

/**
 * `mutate` without awaiting it: for `pendingUx: 'pending'` mutations, whose
 * call resolves only when the server answers — which needs the run's clock
 * to move, so an action cannot sit on it. Clears the client's last result;
 * poll `lastMutationSettled`, then read it as usual.
 */
export const startMutate = defineAction({
  name: 'startMutate',
  act: (
    s: SyncHarness,
    clientId: string,
    named: Mutation<unknown> | string,
    args: unknown
  ) => {
    const mutation = resolveMutation(s, named);
    s.runtime.lastMutation.delete(clientId);
    void requireClient(s, clientId)
      .mutate(mutation, args)
      .then((result) => {
        s.runtime.lastMutation.set(
          clientId,
          result.ok
            ? { ok: true, mutationId: result.mutationId, failures: [] }
            : { ok: false, mutationId: null, failures: result.failures }
        );
      });
  },
});

export const connect = defineAction({
  name: 'connect',
  act: async (s: SyncHarness, clientId: string) => {
    await requireClient(s, clientId).connect();
  },
});

export const disconnect = defineAction({
  name: 'disconnect',
  act: (s: SyncHarness, clientId: string) =>
    requireClient(s, clientId).disconnect(),
});

export const online = defineAction({
  name: 'online',
  act: (s: SyncHarness, clientId: string, value: boolean) => {
    requireClient(s, clientId).online(value);
  },
});

export const foreground = defineAction({
  name: 'foreground',
  act: (s: SyncHarness, clientId: string, value: boolean) => {
    requireClient(s, clientId).foreground(value);
  },
});

export const clearLocalData = defineAction({
  name: 'clearLocalData',
  act: async (s: SyncHarness, clientId: string, reason: string) => {
    await requireClient(s, clientId).clearLocalData(reason);
  },
});

export const nudge = defineAction({
  name: 'nudge',
  act: async (s: SyncHarness, clientId: string) => {
    const client = requireClient(s, clientId);
    // A nudge issued while sync is held never resolves — drive it as far as
    // virtual time allows and leave the wake in flight.
    await driveWhilePending(s, () => client.nudge());
  },
});

export const subscribe = defineAction({
  name: 'subscribe',
  act: async (
    s: SyncHarness,
    clientId: string,
    queryName: string,
    params?: Record<string, unknown>
  ) => {
    const sub = requireClient(s, clientId).subscribe(queryName, params ?? {});
    subscriptions(s).set(subscriptionKey(clientId, queryName), sub);
    await driveToSettled(
      s,
      `subscribe:${clientId}:${queryName}`,
      () => sub.ready
    );
  },
});

/**
 * Open every scope in `paramsList` before waiting on any of them, so the engine
 * batches them into one query POST. Use when the scope count itself is the
 * subject (batch bounds / chunking); prefer {@link subscribe} otherwise.
 */
export const subscribeAll = defineAction({
  name: 'subscribeAll',
  act: async (
    s: SyncHarness,
    clientId: string,
    queryName: string,
    paramsList: readonly Record<string, unknown>[]
  ) => {
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
});

export const unsubscribe = defineAction({
  name: 'unsubscribe',
  act: (s: SyncHarness, clientId: string, queryName: string) => {
    const key = subscriptionKey(clientId, queryName);
    const bag = subscriptions(s);
    bag.get(key)?.[Symbol.dispose]();
    bag.delete(key);
  },
});

function recordPost(s: SyncHarness, clientId: string, rows: PostRows): void {
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
  act: (s: SyncHarness, clientId: string, rows: PostRows) => {
    recordPost(s, clientId, rows);
  },
});

/**
 * Replay wire rows straight at the server handler while impersonating
 * `actorId` — a hostile or late re-POST that never went through a client
 * engine. The verdicts land on `postOutcome(actorId)`.
 */
export const serverReplay = defineAction({
  name: 'serverReplay',
  act: async (s: SyncHarness, actorId: string, rows: PostRows) => {
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
});

export const execSql = defineAction({
  name: 'execSql',
  act: async (s: SyncHarness, nodeId: string, statement: string) => {
    const db = nodeId === 'server' ? s.server.db : requireClient(s, nodeId).db;
    await db.run(unsafe(statement));
  },
});

export const runSql = execSql;

/**
 * Heal owed clients, clear faults, reconnect — stimulus only. Pair with
 * `s.until(inSync)` (or {@link expectInSync}).
 */
export const recoverAll = defineAction({
  name: 'recoverAll',
  act: async (s: SyncHarness) => {
    await prepareClientsForInSync(s);
    resetClockSkews(s);
    await s.recoverAll();
  },
});

/** Wake uploads / refresh on every live client — stimulus for drain waits. */
export const wakeAll = defineAction({
  name: 'wakeAll',
  act: (s: SyncHarness) => {
    for (const client of s.clients.values()) {
      client.engine.wakeUploads();
      void client.engine.refreshQueries().catch(() => undefined);
    }
  },
});

/**
 * One converge pump: wake + drain scheduler (stimulus only).
 * Pair with `s.until(inSync)` / {@link expectInSync}.
 */
export const pump = defineAction({
  name: 'pump',
  act: async (s: SyncHarness) => {
    await pumpInSync(s);
  },
});
