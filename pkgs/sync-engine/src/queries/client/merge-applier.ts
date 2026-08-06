import { assert } from '@pkgs/assert';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type {
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '@pkgs/sync-engine/mutations/core/types';

import type { QueryRow } from '../core/types';
import type { TableChangeBus } from './table-change-bus';
import {
  deleteOrphanRow,
  deleteUntaggedOrphans,
  purgeScopeAbsence,
  tableColumns,
  tagRow,
  upsertRowIntersect,
} from './merge-upsert';

export type MergeFullInput = {
  readonly scopeHash: string;
  readonly checkpoint: string;
  readonly hash: string;
  readonly tables: Readonly<Record<string, readonly QueryRow[]>>;
};

export type MergeApplierDeps = {
  readonly db: SqlClient;
  readonly registry: MutationRegistry;
  readonly env: MutationEnv;
  readonly bus: TableChangeBus;
  readonly clientId: string;
};

type PendingMutation = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly seq: number;
  readonly created_at: string;
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

async function withMergeSingleFlight<T>(
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
  await deps.db.transaction(async (tx) => {
    if (await isStale(tx, input.scopeHash, input.checkpoint)) return;
    for (const [table, rows] of Object.entries(input.tables)) {
      await mergeTable(tx, input.scopeHash, table, rows);
      changed.add(table);
    }
    changed.add('_row_scopes');
    await touchScopeMeta(tx, input);
    await rebasePending(tx, deps, changed);
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
  scopeHash: string,
  table: string,
  rows: readonly QueryRow[]
): Promise<void> {
  const cols = await tableColumns(tx, table);
  const ids: string[] = [];
  for (const row of rows) {
    const id = row['id'];
    assert.ok(typeof id === 'string' && id.length > 0, 'row id required');
    ids.push(id);
    await upsertRowIntersect(tx, table, row, cols);
    await tagRow(tx, table, id, scopeHash);
  }
  await purgeScopeAbsence(tx, table, scopeHash, ids);
  await deleteUntaggedOrphans(tx, table, ids);
}

async function rebasePending(
  tx: SqlClient,
  deps: MergeApplierDeps,
  changed: Set<string>
): Promise<void> {
  const pending = await tx.query(sql<PendingMutation>`
    SELECT id, name, args, seq, created_at
    FROM _mutations
    WHERE client_id = ${deps.clientId}
      AND seq > COALESCE(
        (SELECT last_acked_seq FROM _upload_state WHERE id = ${'singleton'}),
        ${0}
      )
    ORDER BY seq ASC
  `);
  for (const row of pending) {
    await rebaseOne(tx, deps, row, changed);
  }
}

async function rebaseOne(
  tx: SqlClient,
  deps: MergeApplierDeps,
  row: PendingMutation,
  changed: Set<string>
): Promise<void> {
  const m = deps.registry[row.name] as Mutation<unknown> | undefined;
  if (m === undefined) return;
  let args: unknown;
  try {
    args = m.args.parse(JSON.parse(row.args));
  } catch {
    return;
  }
  const env: MutationEnv = {
    ...deps.env,
    now: () => new Date(row.created_at),
  };
  try {
    await m.run({ tx, env }, args);
    for (const t of m.writes) changed.add(t);
  } catch {
    // Keep queued; hide optimistic effect.
  }
}

export async function purgeScope(
  deps: Pick<MergeApplierDeps, 'db' | 'bus'>,
  scopeHash: string
): Promise<void> {
  await withMergeSingleFlight(deps.db, () => runPurgeScope(deps, scopeHash));
}

async function runPurgeScope(
  deps: Pick<MergeApplierDeps, 'db' | 'bus'>,
  scopeHash: string
): Promise<void> {
  const changed = new Set<string>();
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
      await deleteOrphanRow(tx, tbl, row_id);
    }
  });
  deps.bus.emit([...changed, '_row_scopes', '_scope_meta']);
}
