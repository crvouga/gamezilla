import {
  defineAction,
  defineProperty,
  defineRuntime,
  defineSystem,
  virtualTimeRuntime,
} from '@pkgs/harness';
import { gen } from '@pkgs/harness/fast-check';
import {
  corruptHarnessOpfsStore,
  fillHarnessOpfsPool,
} from '@pkgs/sql-client-sqlite-web/owners/harness-opfs-sql-owner';
import fc from 'fast-check';
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

/** Typed topology for one multi-tab web SQL script. */
export type SqlClientWebArgs = {
  readonly tabCount: number;
  readonly poolCapacity: number;
  readonly schemaEpoch: number;
  readonly backend: SqlClientWebBackend;
};

/** tabCount=2, poolCapacity=6, schemaEpoch=1, backend=web-harness-opfs */
export const SQL_CLIENT_WEB_ARGS: SqlClientWebArgs = {
  tabCount: 2,
  poolCapacity: 6,
  schemaEpoch: 1,
  backend: 'web-harness-opfs',
};

export const arbSqlClientWebArgs = (): fc.Arbitrary<SqlClientWebArgs> =>
  fc.record({
    tabCount: fc.integer({ min: 1, max: 3 }),
    poolCapacity: fc.constantFrom(2, 6),
    schemaEpoch: fc.constant(1),
    backend: fc.constantFrom<SqlClientWebBackend>(
      'web-harness-opfs',
      'mockingbird-sqlite'
    ),
  });

export function caps(s: SqlClientWebSurface): string[] {
  return [...s.session.caps];
}

export function tabIdList(s: SqlClientWebSurface): string[] {
  return [...s.tabIds];
}

export function ownerId(s: SqlClientWebSurface): string | null {
  return ownerTabId(boardOf(s));
}

/** Durable `toy_kv` rows as the elected owner sees them (`{}` with no owner). */
export async function ownerRows(
  s: SqlClientWebSurface
): Promise<Record<string, string>> {
  const client = await ensureOwnerClient(boardOf(s));
  if (client === null) return {};
  return Object.fromEntries(await readToyRows(client));
}

export function openOwnerCount(s: SqlClientWebSurface): number {
  return [...boardOf(s).tabs.values()].filter((t) => t.open).length;
}

/**
 * Read a `toy_kv` key via the named tab when it is open, else via the elected
 * owner. Pure observation — does not record mismatches.
 */
export async function get(
  s: SqlClientWebSurface,
  tabId: string,
  key: string
): Promise<string | null> {
  const state = boardOf(s);
  const tab = state.tabs.get(tabId);
  if (tab?.open) {
    return readToyRow(tab.runtime.getClient(), key);
  }
  const client = await ensureOwnerClient(state);
  if (client === null) return null;
  return readToyRow(client, key);
}

export const connect = defineAction({
  name: 'connect',
  enabled: (s: SqlClientWebSurface) => tabIdList(s).length > 0,
  weight: 3,
  sample: (s: SqlClientWebSurface) => gen(fc.constantFrom(...tabIdList(s))),
  act: async (s: SqlClientWebSurface, tabId: string) => {
    await connectTab(boardOf(s), tabId);
  },
});

export const disconnect = defineAction({
  name: 'disconnect',
  enabled: (s: SqlClientWebSurface) => tabIdList(s).length > 0,
  weight: 3,
  sample: (s: SqlClientWebSurface) => gen(fc.constantFrom(...tabIdList(s))),
  act: async (s: SqlClientWebSurface, tabId: string) => {
    await disconnectTab(boardOf(s), tabId);
  },
});

export type PutArgs = {
  readonly tabId: string;
  readonly key: string;
  readonly value: string;
};

export const put = defineAction({
  name: 'put',
  enabled: (s: SqlClientWebSurface) => tabIdList(s).length > 0,
  weight: 3,
  sample: (s: SqlClientWebSurface) =>
    gen(
      fc.record({
        tabId: fc.constantFrom(...tabIdList(s)),
        key: fc.constantFrom(...KEYS),
        value: fc.constantFrom(...VALUES),
      })
    ),
  act: async (s: SqlClientWebSurface, payload: PutArgs) => {
    const state = boardOf(s);
    const client = await connectTab(state, payload.tabId);
    if (client === null) return;
    await writeToyRow(client, payload.key, payload.value);
    state.expected.set(payload.key, payload.value);
    persistImage(state, client);
  },
});

export const killTabAction = defineAction({
  name: 'killTab',
  enabled: (s: SqlClientWebSurface) => tabIdList(s).length > 0,
  sample: (s: SqlClientWebSurface) => gen(fc.constantFrom(...tabIdList(s))),
  act: async (s: SqlClientWebSurface, tabId: string) => {
    await killTab(boardOf(s), tabId);
  },
});

export const fillPool = defineAction({
  name: 'fillPool',
  act: (s: SqlClientWebSurface) => {
    fillHarnessOpfsPool(requireStore(boardOf(s)));
  },
});

export const corruptStore = defineAction({
  name: 'corruptStore',
  act: (s: SqlClientWebSurface) => {
    corruptHarnessOpfsStore(requireStore(boardOf(s)));
  },
});

export const bumpEpoch = defineAction({
  name: 'bumpEpoch',
  act: (s: SqlClientWebSurface) => {
    boardOf(s).epoch += 1;
  },
});

export const inSync = defineProperty({
  name: 'inSync',
  check: async (s: SqlClientWebSurface) => {
    const owners = openOwnerCount(s);
    if (owners > 1) {
      throw new Error(`sql-client.web.multi-owner: ${owners}`);
    }
    // No live owner ⇒ nothing to compare; wipes clear `expected` on reopen.
    if (owners === 0) return;
    const rows = await ownerRows(s);
    for (const [key, want] of boardOf(s).expected) {
      const got = rows[key] ?? null;
      if (got !== want) {
        throw new Error(
          `sql-client.web.stale-read: ${key}=${String(got)} want ${want}`
        );
      }
    }
  },
});

/** One simulated OPFS / mem store + `tabCount` browser tabs racing for ownership. */
export const sqlClientWeb = defineSystem<SqlClientWebSurface, SqlClientWebArgs>(
  {
    name: 'sql-client.web',
    args: SQL_CLIENT_WEB_ARGS,
    sample: () => gen(arbSqlClientWebArgs()),
    create(session, args) {
      const storeSession = session.fork('store');
      const { board } = startStore(storeSession, {
        poolCapacity: args.poolCapacity,
        schemaEpoch: args.schemaEpoch,
        backend: args.backend,
      });
      const tabIds = range(args.tabCount).map((i) => `t${String(i)}`);
      for (const id of tabIds) {
        startTab(session.fork(id), board, id);
      }
      return { session, board, tabIds } satisfies SqlClientWebSurface;
    },
    runtimes: [
      defineRuntime({
        default: true,
        name: 'virtual',
        create: () => virtualTimeRuntime(),
      }),
    ],
    actions: [
      connect,
      disconnect,
      put,
      killTabAction,
      fillPool,
      corruptStore,
      bumpEpoch,
    ],
    properties: [inSync],
  }
);

export type { SqlClientWebSurface };
