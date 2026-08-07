import { assert } from '@pkgs/assert';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { MutationEnv, MutationRegistry } from '../../mutations/core/types';
import type { QueryRow } from '../core/types';
import { confirmOptimistic, rebaseUnconfirmed } from './merge-rebase';
import {
  softTombstoneOrphanRow,
  softTombstoneScopeAbsence,
  softTombstoneUntaggedOrphans,
  tableColumns,
  tagRow,
  upsertRowIntersect,
} from './merge-upsert';
import type { TableChangeBus } from './table-change-bus';

export type MergeFullInput = {
  readonly scopeHash: string;
  readonly checkpoint: string;
  readonly hash: string;
  readonly tables: Readonly<Record<string, readonly QueryRow[]>>;
  /** write_epoch at query request start; omitted → 0 (legacy callers). */
  readonly basisEpoch?: number;
};

export type MergeApplierDeps = {
  readonly db: SqlClient;
  readonly registry: MutationRegistry;
  readonly env: MutationEnv;
  readonly bus: TableChangeBus;
  readonly clientId: string;
};

/** Per-db single-flight chain — concurrent polls queue; never overlap writers. */
type MergeGate = { chain: Promise<void> };
const mergeGates = new WeakMap<object, MergeGate>();

function mergeGateFor(db: object): MergeGate {
  const existing = mergeGates.get(db);
  if (existing !== undefined) return existing;
  const created: MergeGate = { chain: Promise.resolve() };
  mergeGates.set(db, created);
  return created;
}

export async function withMergeSingleFlight<T>(
  db: object,
  write: () => Promise<T>
): Promise<T> {
  const gate = mergeGateFor(db);
  const run = gate.chain.then(write, write);
  gate.chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function applyFullMerge(
  deps: MergeApplierDeps,
  input: MergeFullInput
): Promise<'applied' | 'stale'> {
  return withMergeSingleFlight(deps.db, () => runMerge(deps, input));
}

async function runMerge(
  deps: MergeApplierDeps,
  input: MergeFullInput
): Promise<'applied' | 'stale'> {
  let applied = false;
  const changed = new Set<string>();
  const basisEpoch = input.basisEpoch ?? 0;
  const now = deps.env.now().toISOString();
  await deps.db.transaction(async (tx) => {
    if (await isStale(tx, input.scopeHash, input.checkpoint)) return;
    for (const [table, rows] of Object.entries(input.tables)) {
      await mergeTable(tx, {
        scopeHash: input.scopeHash,
        table,
        rows,
        now,
      });
      changed.add(table);
    }
    changed.add('_row_scopes');
    await touchScopeMeta(tx, input);
    await rebaseUnconfirmed(
      tx,
      {
        registry: deps.registry,
        env: deps.env,
        clientId: deps.clientId,
      },
      basisEpoch,
      changed
    );
    await confirmOptimistic(tx, deps.clientId, basisEpoch);
    applied = true;
  });
  if (!applied) return 'stale';
  deps.bus.emit([...changed]);
  return 'applied';
}

async function isStale(
  tx: SqlClient,
  scopeHash: string,
  checkpoint: string
): Promise<boolean> {
  const meta = await tx.query(sql<{ last_checkpoint: string | null }>`
    SELECT last_checkpoint FROM _scope_meta
    WHERE scope_hash = ${scopeHash} LIMIT 1
  `);
  const prev = meta[0]?.last_checkpoint ?? null;
  if (prev === null) return false;
  return compareCheckpoint(checkpoint, prev) <= 0;
}

function compareCheckpoint(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

async function touchScopeMeta(
  tx: SqlClient,
  input: MergeFullInput
): Promise<void> {
  const now = new Date().toISOString();
  await tx.run(sql`
    INSERT INTO _scope_meta (scope_hash, last_active_at, last_checkpoint, last_hash)
    VALUES (${input.scopeHash}, ${now}, ${input.checkpoint}, ${input.hash})
    ON CONFLICT (scope_hash) DO UPDATE SET
      last_checkpoint = excluded.last_checkpoint,
      last_hash = excluded.last_hash,
      last_active_at = excluded.last_active_at
  `);
}

async function mergeTable(
  tx: SqlClient,
  args: {
    readonly scopeHash: string;
    readonly table: string;
    readonly rows: readonly QueryRow[];
    readonly now: string;
  }
): Promise<void> {
  const { scopeHash, table, rows, now } = args;
  const cols = await tableColumns(tx, table);
  const ids: string[] = [];
  for (const row of rows) {
    const id = row['id'];
    assert.ok(typeof id === 'string' && id.length > 0, 'row id required');
    ids.push(id);
    await upsertRowIntersect(tx, table, row, cols);
    await tagRow(tx, table, id, scopeHash);
  }
  await softTombstoneScopeAbsence(tx, {
    table,
    scopeHash,
    presentIds: ids,
    now,
  });
  await softTombstoneUntaggedOrphans(tx, table, ids, now);
}

/**
 * Drop scope tags + meta only. Domain rows stay (unsubscribe / detach).
 */
export async function detachScope(
  deps: Pick<MergeApplierDeps, 'db' | 'bus'>,
  scopeHash: string
): Promise<void> {
  await withMergeSingleFlight(deps.db, () => runDetachScope(deps, scopeHash));
}

async function runDetachScope(
  deps: Pick<MergeApplierDeps, 'db' | 'bus'>,
  scopeHash: string
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    await tx.run(sql`
      DELETE FROM _row_scopes WHERE scope_hash = ${scopeHash}
    `);
    await tx.run(sql`
      DELETE FROM _scope_meta WHERE scope_hash = ${scopeHash}
    `);
  });
  deps.bus.emit(['_row_scopes', '_scope_meta']);
}

/**
 * Soft-tombstone domain rows tagged by this scope (when last tag drops), then
 * clear framework scope tables. Used for denied/gone.
 */
export async function tombstoneScope(
  deps: Pick<MergeApplierDeps, 'db' | 'bus' | 'env'>,
  scopeHash: string
): Promise<void> {
  await withMergeSingleFlight(deps.db, () =>
    runTombstoneScope(deps, scopeHash)
  );
}

async function runTombstoneScope(
  deps: Pick<MergeApplierDeps, 'db' | 'bus' | 'env'>,
  scopeHash: string
): Promise<void> {
  const changed = new Set<string>();
  const now = deps.env.now().toISOString();
  await deps.db.transaction(async (tx) => {
    const tags = await tx.query(sql<{ tbl: string; row_id: string }>`
      SELECT tbl, row_id FROM _row_scopes WHERE scope_hash = ${scopeHash}
    `);
    await tx.run(sql`
      DELETE FROM _row_scopes WHERE scope_hash = ${scopeHash}
    `);
    await tx.run(sql`
      DELETE FROM _scope_meta WHERE scope_hash = ${scopeHash}
    `);
    for (const { tbl, row_id } of tags) {
      changed.add(tbl);
      await softTombstoneOrphanRow(tx, tbl, row_id, now);
    }
  });
  deps.bus.emit([...changed, '_row_scopes', '_scope_meta']);
}
