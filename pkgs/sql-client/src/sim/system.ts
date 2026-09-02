import {
  type ActionCatalog,
  defineScenario,
  nodeCount,
  properties,
  property,
  std,
  type World,
} from '@pkgs/dst';
import { SQL_CLIENT_WEB_ACTIONS } from './actions';
import {
  SQL_BACKEND,
  SQL_POOL_CAPACITY,
  SQL_SCHEMA_EPOCH,
  SQL_TAB_COUNT,
  sqlWebStoreNode,
  sqlWebTabNode,
} from './nodes';
import { closeAllRuntimes, connectTab, ensureOwnerClient } from './ownership';
import { readToyRows, readUserVersion, VERSION_STRIDE } from './toy-kv';
import { boardOf, kvFingerprint } from './types';

const WORLD_START_MS = 1_700_000_000_000;

type SqlWebKnobs = {
  readonly tabCount: typeof SQL_TAB_COUNT;
  readonly poolCapacity: typeof SQL_POOL_CAPACITY;
  readonly schemaEpoch: typeof SQL_SCHEMA_EPOCH;
  readonly backend: typeof SQL_BACKEND;
};

type SqlWebNodes = {
  readonly store: typeof sqlWebStoreNode;
  readonly tab: typeof sqlWebTabNode & {
    readonly count: (
      knobs: import('@pkgs/dst').KnobValues<SqlWebKnobs>
    ) => number;
    readonly id: (index: number) => string;
  };
};

export type SqlClientWebSurface = World<
  SqlWebKnobs,
  SqlWebNodes,
  Record<string, never>
>;

async function settleSqlClientWeb(
  world: World<SqlWebKnobs, SqlWebNodes>
): Promise<void> {
  const state = boardOf(world);
  await world.quiesce();
  if (state.appliedEpoch !== state.epoch) {
    await closeAllRuntimes(state);
  }
  for (const tabId of world.nodeIds('tab')) {
    await connectTab(state, tabId);
  }
  const client = await ensureOwnerClient(state);
  if (client === null) {
    throw new Error('sql-client.web: no tab could own the cache after settle');
  }
  await readToyRows(client);
}

async function assertSqlClientWebConverged(
  world: World<SqlWebKnobs, SqlWebNodes>
): Promise<void> {
  const state = boardOf(world);
  const stale = state.mismatches[0];
  if (stale !== undefined) {
    throw new Error(`sql-client.web.stale-read: ${stale}`);
  }
  const open = [...state.tabs.values()].filter((tab) => tab.open);
  if (open.length > 1) {
    throw new Error(
      `sql-client.web.multi-owner: ${open.map((tab) => tab.id).join(',')}`
    );
  }
  const owner = open[0];
  if (owner === undefined) return;
  const client = owner.runtime.getClient();
  const version = await readUserVersion(client);
  if (Math.floor(version / VERSION_STRIDE) !== state.epoch) {
    throw new Error(
      `sql-client.web.schema-epoch: user_version ${version} for epoch ${state.epoch}`
    );
  }
  const got = kvFingerprint(await readToyRows(client));
  const want = kvFingerprint(state.expected);
  if (got !== want) {
    throw new Error(`sql-client.web.rows-diverge: ${got} !== ${want}`);
  }
}

/**
 * Multi-tab web SQLite world: one shared simulated-OPFS store, an in-process
 * broker electing a single owner tab, and chaos that exhausts the handle pool,
 * corrupts the image, kills tabs, or bumps the schema epoch.
 */
export function defineSqlClientWebSystem(opts?: { readonly id?: string }) {
  return defineScenario({
    id: opts?.id ?? 'sql-client.web',
    startTime: WORLD_START_MS,
    knobs: {
      tabCount: SQL_TAB_COUNT,
      poolCapacity: SQL_POOL_CAPACITY,
      schemaEpoch: SQL_SCHEMA_EPOCH,
      backend: SQL_BACKEND,
    },
    nodes: {
      store: sqlWebStoreNode,
      tab: {
        ...sqlWebTabNode,
        count: nodeCount<SqlWebKnobs>((k) => k.tabCount),
        id: (i) => `t${String(i)}`,
      },
    },
    actions: {
      ...std.time(),
      ...SQL_CLIENT_WEB_ACTIONS,
    } as unknown as ActionCatalog<SqlClientWebSurface>,
    properties: properties<SqlClientWebSurface>()({
      converged: property.always(async () => true, { at: 'converge' }),
    }),
    converge: async (world) => {
      const sqlWorld = world as World<SqlWebKnobs, SqlWebNodes>;
      await settleSqlClientWeb(sqlWorld);
      await assertSqlClientWebConverged(sqlWorld);
    },
  } as import('@pkgs/dst').AnyScenarioDef);
}

export const SQL_CLIENT_WEB_SYSTEM = defineSqlClientWebSystem();

export type SqlClientWebSystemDef = typeof SQL_CLIENT_WEB_SYSTEM;
export type SqlClientWebWorld = SqlClientWebSurface;
