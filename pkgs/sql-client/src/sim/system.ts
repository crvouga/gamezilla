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

export const sqlClientWeb = defineSystem({
  name: 'sql-client.web',
  async *generate(session) {
    const tabCount = yield* draw(gen(fc.integer({ min: 1, max: 3 })));
    const poolCapacity = yield* draw(gen(fc.constantFrom(2, 6)));
    const schemaEpoch = yield* draw(gen(fc.constant(1)));
    const backend = yield* draw(
      gen(fc.constantFrom<SqlClientWebBackend>('web-sim-opfs', 'sqlite-mem'))
    );
    const storeSession = session.fork('store');
    const { board } = startStore(storeSession, {
      poolCapacity,
      schemaEpoch,
      backend,
    });
    const tabIds = range(tabCount).map((i) => `t${String(i)}`);
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
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => Math.floor(rng.next() * 5_000));
    yield {
      weight: 1,
      act: (s: SqlClientWebSurface) => s.session.scheduler.advance(ms),
    };
  },
});

export const connect = defineAction({
  name: 'connect',
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

export const put = defineAction({
  name: 'put',
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
    yield {
      weight: 3,
      act: async (s: SqlClientWebSurface) => {
        const state = boardOf(s);
        const client = await connectTab(state, payload.tabId);
        if (client === null) return;
        await writeToyRow(client, payload.key, payload.value);
        state.expected.set(payload.key, payload.value);
        persistImage(state, client);
      },
    };
  },
});

export const get = defineAction({
  name: 'get',
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
    yield {
      weight: 3,
      act: async (s: SqlClientWebSurface) => {
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
      },
    };
  },
});

export const killTabAction = defineAction({
  name: 'killTab',
  *generate() {
    const ids = yield* tabIdList;
    if (ids.length === 0) return;
    const tabId = yield* draw(gen(fc.constantFrom(...(ids as string[]))));
    yield {
      weight: 1,
      act: (s: SqlClientWebSurface) => killTab(boardOf(s), tabId),
    };
  },
});

export const fillPool = defineAction({
  name: 'fillPool',
  *generate() {
    yield {
      weight: 1,
      act: (s: SqlClientWebSurface) => {
        fillSimOpfsPool(requireStore(boardOf(s)));
      },
    };
  },
});

export const corruptStore = defineAction({
  name: 'corruptStore',
  *generate() {
    yield {
      weight: 1,
      act: (s: SqlClientWebSurface) => {
        corruptSimOpfsStore(requireStore(boardOf(s)));
      },
    };
  },
});

export const bumpEpoch = defineAction({
  name: 'bumpEpoch',
  *generate() {
    yield {
      weight: 1,
      act: (s: SqlClientWebSurface) => {
        boardOf(s).epoch += 1;
      },
    };
  },
});

export const SQL_CLIENT_WEB_ACTIONS = [
  passTime,
  connect,
  disconnect,
  put,
  get,
  killTabAction,
  fillPool,
  corruptStore,
  bumpEpoch,
];

export const converged = defineProperty({
  name: 'converged',
  *watch() {
    while (true) {
      const [mismatches, owners] = (yield observe(
        mismatchCount,
        openOwnerCount
      )) as [number, number];
      if (mismatches > 0) {
        throw new Error(
          `sql-client.web.stale-read: ${mismatches} mismatch(es)`
        );
      }
      if (owners > 1) {
        throw new Error(`sql-client.web.multi-owner: ${owners}`);
      }
    }
  },
});

export const SQL_CLIENT_WEB_PROPERTIES = [converged];

export const SQL_CLIENT_WEB_SYSTEM = sqlClientWeb;
export type SqlClientWebSystemDef = typeof sqlClientWeb;
export type { SqlClientWebSurface };
