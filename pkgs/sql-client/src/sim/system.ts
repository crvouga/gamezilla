import { defineSystem, draw, observe } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import {
  corruptSimOpfsStore,
  fillSimOpfsPool,
} from '../sqlite/web/owners/sim-opfs-sql-owner';
import { startStore, startTab } from './nodes';
import { persistImage } from './owners';
import {
  connectTab,
  disconnectTab,
  ensureOwnerClient,
  killTab,
  ownerTabId,
} from './ownership';
import { readToyRow, readToyRows, writeToyRow } from './toy-kv';
import {
  boardOf,
  requireStore,
  type SqlClientWebBackend,
  type SqlClientWebSurface,
} from './types';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

const KEYS = ['a', 'b', 'c'] as const;
const VALUES = ['1', '2', ''] as const;

export type SqlClientWebKnobs = {
  readonly tabCount: number;
  readonly poolCapacity: number;
  readonly schemaEpoch: number;
  readonly backend: SqlClientWebBackend;
};

export const sqlClientWeb = defineSystem({
  name: 'sql-client.web',
  generate(session, knobs: SqlClientWebKnobs) {
    const storeSession = session.fork('store');
    const { board } = startStore(storeSession, {
      poolCapacity: knobs.poolCapacity,
      schemaEpoch: knobs.schemaEpoch,
      backend: knobs.backend,
    });
    const tabIds = range(knobs.tabCount).map((i) => `t${String(i)}`);
    for (const id of tabIds) {
      startTab(session.fork(id), board, id);
    }
    return { session, board, tabIds } satisfies SqlClientWebSurface;
  },
});

const { defineObservation, defineAction, defineProperty } = sqlClientWeb;

export const caps = defineObservation({
  name: 'caps',
  observe: (s) => [...s.session.caps] as string[],
});

export const tabIdList = defineObservation({
  name: 'tabIdList',
  observe: (s) => [...s.tabIds],
});

export const ownerId = defineObservation({
  name: 'ownerId',
  observe: (s) => ownerTabId(boardOf(s)),
});

/** Durable `toy_kv` rows as the elected owner sees them (`{}` with no owner). */
export const ownerRows = defineObservation({
  name: 'ownerRows',
  observe: async (s) => {
    const client = await ensureOwnerClient(boardOf(s));
    if (client === null) return {} as Record<string, string>;
    return Object.fromEntries(await readToyRows(client)) as Record<
      string,
      string
    >;
  },
});

export const mismatchCount = defineObservation({
  name: 'mismatchCount',
  observe: (s) => boardOf(s).mismatches.length,
});

export const openOwnerCount = defineObservation({
  name: 'openOwnerCount',
  observe: (s) => [...boardOf(s).tabs.values()].filter((t) => t.open).length,
});

export const passTime = defineAction({
  name: 'passTime',
  generate(ms: number) {
    return (s) => s.session.scheduler.advance(ms);
  },
});

export const randomPassTime = defineAction({
  name: 'randomPassTime',
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => Math.floor(rng.next() * 5_000));
    yield* passTime(ms);
  },
});

export const connect = defineAction({
  name: 'connect',
  generate(tabId: string) {
    return (s) => connectTab(boardOf(s), tabId);
  },
});

export const randomConnect = defineAction({
  name: 'randomConnect',
  *generate() {
    const ids = yield* tabIdList;
    if (ids.length === 0) return;
    const tabId = yield* draw(gen(fc.constantFrom(...(ids as string[]))));
    yield {
      weight: 3,
      act: (s: SqlClientWebSurface) => connectTab(boardOf(s), tabId),
    };
  },
});

export const disconnect = defineAction({
  name: 'disconnect',
  generate(tabId: string) {
    return (s) => disconnectTab(boardOf(s), tabId);
  },
});

export const randomDisconnect = defineAction({
  name: 'randomDisconnect',
  *generate() {
    const ids = yield* tabIdList;
    if (ids.length === 0) return;
    const tabId = yield* draw(gen(fc.constantFrom(...(ids as string[]))));
    yield {
      weight: 3,
      act: (s: SqlClientWebSurface) => disconnectTab(boardOf(s), tabId),
    };
  },
});

export type PutArgs = {
  readonly tabId: string;
  readonly key: string;
  readonly value: string;
};

export const put = defineAction({
  name: 'put',
  generate(payload: PutArgs) {
    return async (s) => {
      const state = boardOf(s);
      const client = await connectTab(state, payload.tabId);
      if (client === null) return;
      await writeToyRow(client, payload.key, payload.value);
      state.expected.set(payload.key, payload.value);
      persistImage(state, client);
    };
  },
});

export const randomPut = defineAction({
  name: 'randomPut',
  *generate() {
    const ids = yield* tabIdList;
    if (ids.length === 0) return;
    const payload = yield* draw(
      gen(
        fc.record({
          tabId: fc.constantFrom(...(ids as string[])),
          key: fc.constantFrom(...KEYS),
          value: fc.constantFrom(...VALUES),
        })
      )
    );
    yield* put(payload);
  },
});

export type GetArgs = {
  readonly tabId: string;
  readonly key: string;
};

export const get = defineAction({
  name: 'get',
  generate(payload: GetArgs) {
    return async (s) => {
      const state = boardOf(s);
      const client = await connectTab(state, payload.tabId);
      if (client === null) return;
      const got = await readToyRow(client, payload.key);
      const want = state.expected.get(payload.key) ?? null;
      if (got !== want) {
        state.mismatches.push(
          `tab ${payload.tabId} read ${payload.key}=${String(got)} want ${String(want)}`
        );
      }
    };
  },
});

export const randomGet = defineAction({
  name: 'randomGet',
  *generate() {
    const ids = yield* tabIdList;
    if (ids.length === 0) return;
    const payload = yield* draw(
      gen(
        fc.record({
          tabId: fc.constantFrom(...(ids as string[])),
          key: fc.constantFrom(...KEYS),
        })
      )
    );
    yield* get(payload);
  },
});

export const killTabAction = defineAction({
  name: 'killTab',
  generate(tabId: string) {
    return (s) => killTab(boardOf(s), tabId);
  },
});

export const randomKillTab = defineAction({
  name: 'randomKillTab',
  *generate() {
    const ids = yield* tabIdList;
    if (ids.length === 0) return;
    const tabId = yield* draw(gen(fc.constantFrom(...(ids as string[]))));
    yield* killTabAction(tabId);
  },
});

export const fillPool = defineAction({
  name: 'fillPool',
  generate() {
    return (s) => {
      fillSimOpfsPool(requireStore(boardOf(s)));
    };
  },
});

export const corruptStore = defineAction({
  name: 'corruptStore',
  generate() {
    return (s) => {
      corruptSimOpfsStore(requireStore(boardOf(s)));
    };
  },
});

export const bumpEpoch = defineAction({
  name: 'bumpEpoch',
  generate() {
    return (s) => {
      boardOf(s).epoch += 1;
    };
  },
});

export const SQL_CLIENT_WEB_ACTIONS = [
  randomPassTime,
  randomConnect,
  randomDisconnect,
  randomPut,
  randomGet,
  randomKillTab,
  fillPool,
  corruptStore,
  bumpEpoch,
];

export const converged = defineProperty({
  name: 'converged',
  *watch() {
    const o = yield* observe({ mismatchCount, openOwnerCount });
    if (o.mismatchCount > 0) {
      throw new Error(
        `sql-client.web.stale-read: ${o.mismatchCount} mismatch(es)`
      );
    }
    if (o.openOwnerCount > 1) {
      throw new Error(`sql-client.web.multi-owner: ${o.openOwnerCount}`);
    }
  },
});

export const SQL_CLIENT_WEB_PROPERTIES = [converged];

export const arbSqlClientWebKnobs = (): fc.Arbitrary<SqlClientWebKnobs> =>
  fc.record({
    tabCount: fc.integer({ min: 1, max: 3 }),
    poolCapacity: fc.constantFrom(2, 6),
    schemaEpoch: fc.constant(1),
    backend: fc.constantFrom<SqlClientWebBackend>('web-sim-opfs', 'sqlite-mem'),
  });

export const SQL_CLIENT_WEB_SYSTEM = sqlClientWeb;
export type SqlClientWebSystemDef = typeof sqlClientWeb;
export type { SqlClientWebSurface };
