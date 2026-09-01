import {
  defineKnob,
  defineSystem,
  type InvariantViolation,
  type SystemDef,
  type World,
} from '@pkgs/determinism';
import fc from 'fast-check';
import { SQL_CLIENT_WEB_ACTIONS } from './actions';
import { sqlWebStoreNode, sqlWebTabNode } from './nodes';
import { closeAllRuntimes, connectTab, ensureOwnerClient } from './ownership';
import { readToyRows, readUserVersion, VERSION_STRIDE } from './toy-kv';
import {
  createSqlClientWebState,
  kvFingerprint,
  type SqlClientWebState,
} from './types';

const WORLD_START_MS = 1_700_000_000_000;

export type SqlClientWebSystemDef = SystemDef<SqlClientWebState>;
export type SqlClientWebWorld = World<SqlClientWebState>;

/**
 * Bring every tab back, apply any pending schema epoch by reloading, and
 * require that some tab can open the cache — recovering in-process if the
 * simulated OPFS pool is exhausted or the image is corrupt.
 */
async function settleSqlClientWeb(world: SqlClientWebWorld): Promise<void> {
  const state = world.state;
  await world.idle();
  if (state.appliedEpoch !== state.epoch) {
    await closeAllRuntimes(state);
  }
  for (const tabId of world.roleIds('tab')) {
    await connectTab(state, tabId);
  }
  const client = await ensureOwnerClient(state);
  if (client === null) {
    throw new Error('sql-client.web: no tab could own the cache after settle');
  }
  await readToyRows(client);
}

async function checkSqlClientWeb(
  world: SqlClientWebWorld
): Promise<InvariantViolation | null> {
  const state = world.state;
  const stale = state.mismatches[0];
  if (stale !== undefined) {
    return { invariant: 'sql-client.web.stale-read', detail: stale };
  }
  const open = [...state.tabs.values()].filter((tab) => tab.open);
  if (open.length > 1) {
    return {
      invariant: 'sql-client.web.multi-owner',
      detail: open.map((tab) => tab.id).join(','),
    };
  }
  const owner = open[0];
  if (owner === undefined) return null;
  const client = owner.runtime.getClient();
  const version = await readUserVersion(client);
  if (Math.floor(version / VERSION_STRIDE) !== state.epoch) {
    return {
      invariant: 'sql-client.web.schema-epoch',
      detail: `user_version ${version} for epoch ${state.epoch}`,
    };
  }
  const got = kvFingerprint(await readToyRows(client));
  const want = kvFingerprint(state.expected);
  if (got !== want) {
    return {
      invariant: 'sql-client.web.rows-diverge',
      detail: `${got} !== ${want}`,
    };
  }
  return null;
}

/**
 * Multi-tab web SQLite world: one shared simulated-OPFS store, an in-process
 * broker electing a single owner tab, and chaos that exhausts the handle pool,
 * corrupts the image, kills tabs, or bumps the schema epoch.
 */
export function defineSqlClientWebSystem(opts?: {
  readonly id?: string;
}): SqlClientWebSystemDef {
  return defineSystem<SqlClientWebState>({
    id: opts?.id ?? 'sql-client.web',
    startMs: WORLD_START_MS,
    state: createSqlClientWebState,
    knobs: [
      defineKnob({
        id: 'tabCount',
        default: 2,
        arb: fc.integer({ min: 1, max: 3 }),
      }),
      defineKnob({
        id: 'poolCapacity',
        default: 6,
        arb: fc.constantFrom(2, 6),
      }),
      defineKnob({ id: 'schemaEpoch', default: 1, arb: fc.constant(1) }),
      defineKnob({
        id: 'backend',
        default: 'web-sim-opfs',
        arb: fc.constantFrom('web-sim-opfs', 'sqlite-mem'),
      }),
    ],
    nodes: [
      { kind: sqlWebStoreNode, role: 'store', count: 1 },
      {
        kind: sqlWebTabNode,
        role: 'tab',
        countFromKnob: 'tabCount',
        idFor: (i) => `t${String(i)}`,
      },
    ],
    actions: SQL_CLIENT_WEB_ACTIONS,
    model: { initial: () => ({}) },
    settle: settleSqlClientWeb,
    invariants: checkSqlClientWeb,
  });
}

export const SQL_CLIENT_WEB_SYSTEM = defineSqlClientWebSystem();
