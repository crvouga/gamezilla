import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { isMutationError } from '../mutations/core/failures';

import type {
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../mutations/core/types';
import { wrapMutationDb } from '../mutations/shared/wrap-mutation-db';
import type { TableChangeBus } from '../queries/client/table-change-bus';
import type { QueryRow } from '../queries/core/types';
import { parseStandardSchema } from '../shared/standard-schema';
import { isValidTableName, mergeTable } from './merge-upsert';
import {
  clearOptimisticPeerRows,
  healOptimisticPeerOrphans,
  recordOptimisticPeerRows,
} from './optimistic-peer-rows';
import { compareCheckpoint } from './push-applied';

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

async function isStale(
  tx: SqlClient,
  scopeHash: string,
  checkpoint: string
): Promise<boolean> {
  const meta = await tx.query(sql<{ last_checkpoint: string | null }>`
    SELECT last_checkpoint FROM sync_engine_scope_meta
    WHERE scope_hash = ${scopeHash} LIMIT 1
  `);
  const prev = meta[0]?.last_checkpoint ?? null;
  if (prev === null) return false;
  return compareCheckpoint(checkpoint, prev) <= 0;
}

async function touchScopeMeta(
  tx: SqlClient,
  input: MergeFullInput,
  now: () => Date
): Promise<void> {
  const nowIso = now().toISOString();
  await tx.run(sql`
    INSERT INTO sync_engine_scope_meta (scope_hash, last_active_at, last_checkpoint, last_hash)
    VALUES (${input.scopeHash}, ${nowIso}, ${input.checkpoint}, ${input.hash})
    ON CONFLICT (scope_hash) DO UPDATE SET
      last_checkpoint = excluded.last_checkpoint,
      last_hash = excluded.last_hash,
      last_active_at = excluded.last_active_at
  `);
}

type PendingMutation = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly created_at: string;
};

/** Rebase every pending local mutation after a server merge. */
async function rebasePending(
  tx: SqlClient,
  deps: Pick<MergeApplierDeps, 'registry' | 'env' | 'clientId'>,
  changed: Set<string>
): Promise<void> {
  const pending = await tx.query(sql<PendingMutation>`
    SELECT id, name, args, created_at
    FROM sync_engine_mutations
    WHERE client_id = ${deps.clientId}
    ORDER BY seq ASC
  `);
  for (const row of pending) {
    const m = deps.registry[row.name] as Mutation<unknown> | undefined;
    // Unknown mutation name after a client upgrade: keep queued; upload rejects.
    if (m === undefined) continue;
    let rawArgs: unknown;
    try {
      rawArgs = JSON.parse(row.args);
    } catch {
      // Keep queued; upload rejects as INVALID_ARGS (same as schema failure).
      continue;
    }
    const parsed = await parseStandardSchema(m.args, rawArgs);
    if (!parsed.ok) continue;
    try {
      const env = {
        ...deps.env,
        now: () => new Date(row.created_at),
      };
      const wrapped = wrapMutationDb(tx, env);
      await m.run({ tx: wrapped.tx, env }, parsed.value);
      for (const t of wrapped.getCapture().tables) changed.add(t);
    } catch (error) {
      if (isMutationError(error)) {
        // Keep queued; hide optimistic effect until upload/reject.
        continue;
      }
      throw error;
    }
  }
}

async function runMerge(
  deps: MergeApplierDeps,
  input: MergeFullInput
): Promise<'applied' | 'stale'> {
  let applied = false;
  const changed = new Set<string>();
  await deps.db.transaction(async (tx) => {
    if (await isStale(tx, input.scopeHash, input.checkpoint)) {
      return;
    }
    for (const [table, rows] of Object.entries(input.tables)) {
      const ok = await mergeTable({
        tx,
        table,
        rows,
        env: deps.env,
      });
      if (ok) changed.add(table);
    }
    for (const table of await healOptimisticPeerOrphans(
      tx,
      input.tables,
      deps.env.now().toISOString()
    )) {
      changed.add(table);
    }
    await touchScopeMeta(tx, input, deps.env.now);
    await rebasePending(tx, deps, changed);
    applied = true;
  });
  if (!applied) return 'stale';
  deps.bus.emit([...changed]);
  return 'applied';
}

export async function applyFullMerge(
  deps: MergeApplierDeps,
  input: MergeFullInput
): Promise<'applied' | 'stale'> {
  return withMergeSingleFlight(deps.db, () => runMerge(deps, input));
}

/**
 * Drop peer-install rows that declare `device_id` ownership. Device-private
 * tables (e.g. open sessions) must not land via user-topic fanout.
 */
function filterDeviceOwnedRows(
  deps: MergeApplierDeps,
  rows: readonly QueryRow[]
): readonly QueryRow[] {
  if (rows.length === 0) return rows;
  const sample = rows[0];
  if (sample === undefined || !('device_id' in sample)) return rows;
  return rows.filter((row) => {
    const owner = row['device_id'];
    return typeof owner !== 'string' || owner === deps.env.deviceId;
  });
}

/**
 * Apply post-replay row images from a push through the same upsert +
 * rebase path as a full snapshot merge.
 *
 * Intentionally does **not** update `sync_engine_scope_meta.last_hash`: the hash echoes
 * the server's last full-snapshot content so `not_modified` stays sound. A
 * rows-apply changes local content without claiming a full snapshot.
 *
 * When `optimistic` is true, ids are recorded so a later confirming snapshot
 * can soft-delete orphans that never committed on the server.
 */
export async function applyRowImages(
  deps: MergeApplierDeps,
  tables: Readonly<Record<string, readonly QueryRow[]>>,
  opts?: { readonly optimistic?: boolean }
): Promise<void> {
  const filtered: Record<string, readonly QueryRow[]> = {};
  for (const [table, rows] of Object.entries(tables)) {
    // Drop invalid names before merge / optimistic-peer bookkeeping.
    if (!isValidTableName(table)) continue;
    filtered[table] = filterDeviceOwnedRows(deps, rows);
  }
  await withMergeSingleFlight(deps.db, async () => {
    const changed = new Set<string>();
    await deps.db.transaction(async (tx) => {
      for (const [table, rows] of Object.entries(filtered)) {
        if (rows.length === 0) continue;
        // Skip unknown tables (empty PRAGMA); skip bad ids. Do not
        // blanket-catch SQL errors (that would commit a partial table).
        const ok = await mergeTable({
          tx,
          table,
          rows,
          env: deps.env,
          skipInvalidIds: true,
        });
        if (ok) changed.add(table);
      }
      if (opts?.optimistic === true) {
        await recordOptimisticPeerRows(tx, filtered);
      } else {
        await clearOptimisticPeerRows(tx, filtered);
      }
      await rebasePending(tx, deps, changed);
    });
    if (changed.size > 0) deps.bus.emit([...changed]);
  });
}

/**
 * Drop scope checkpoint/hash only. Domain rows stay (unsubscribe / denied).
 */
export async function detachScope(
  deps: Pick<MergeApplierDeps, 'db' | 'bus'>,
  scopeHash: string
): Promise<void> {
  await withMergeSingleFlight(deps.db, async () => {
    await deps.db.run(sql`
      DELETE FROM sync_engine_scope_meta WHERE scope_hash = ${scopeHash}
    `);
    deps.bus.emit(['sync_engine_scope_meta']);
  });
}
