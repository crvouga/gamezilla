import { defineSystem } from '@pkgs/determinism';
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

type SqlWebWorld = import('@pkgs/determinism').World<
  Record<string, import('@pkgs/determinism').KnobDef>,
  Record<string, import('@pkgs/determinism').NodeSpecEntry>
>;

async function settleSqlClientWeb(world: SqlWebWorld): Promise<void> {
  const state = boardOf(world);
  await world.idle();
  if (state.appliedEpoch !== state.epoch) {
    await closeAllRuntimes(state);
  }
  for (const tabId of world.ids('tab')) {
    await connectTab(state, tabId);
  }
  const client = await ensureOwnerClient(state);
  if (client === null) {
    throw new Error('sql-client.web: no tab could own the cache after settle');
  }
  await readToyRows(client);
}

async function assertSqlClientWebConverged(world: SqlWebWorld): Promise<void> {
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
  return defineSystem({
    id: opts?.id ?? 'sql-client.web',
    startMs: WORLD_START_MS,
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
        count: (k) => k['tabCount'] as number,
        id: (i) => `t${String(i)}`,
      },
    },
    actions: SQL_CLIENT_WEB_ACTIONS,
    model: { initial: () => ({}) },
    settle: async (world) => {
      await settleSqlClientWeb(world);
      await assertSqlClientWebConverged(world);
    },
    invariants: async () => {
      /* convergence checked in settle */
    },
  });
}

export const SQL_CLIENT_WEB_SYSTEM = defineSqlClientWebSystem();

export type SqlClientWebSystemDef = typeof SQL_CLIENT_WEB_SYSTEM;
export type SqlClientWebWorld = SqlWebWorld;
