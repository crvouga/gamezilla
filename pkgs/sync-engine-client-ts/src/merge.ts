import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import {
  activeSpan,
  observeSync,
  observeSyncNow,
} from '@pkgs/observability-root-shared-ts/span';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

import { isMutationError } from '@pkgs/sync-engine-shared-ts/failures';

import type {
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import {
  compareCheckpoint,
  raiseScopeCheckpoints,
} from '@pkgs/sync-engine-shared-ts/push-applied';
import { parseStandardSchema } from '@pkgs/sync-engine-shared-ts/standard-schema';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import {
  assertCompleteNewRowImages,
  isValidTableName,
  mergeTable,
} from './merge-upsert';
import {
  clearOptimisticPeerRows,
  healOptimisticPeerOrphans,
} from './optimistic-peer-rows';
import type { TableChangeBus } from './table-change-bus';

export type MergeFullInput = {
  readonly scopeHash: string;
  readonly checkpoint: string;
  readonly hash: string;
  readonly tables: Readonly<Record<string, readonly QueryRow[]>>;
  /** Rechecked after the merge and database queues grant this response its turn. */
  readonly isCurrent?: () => boolean;
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
  // Start the wait span at enqueue time; the execution span starts only once
  // the preceding writer releases the gate. Both close on success or failure.
  const previous = gate.chain;
  const ready = observeSync('queue', () => previous);
  const execute = () => observeSync('merge', write);
  const run = ready.then(execute, execute);
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
    WHERE scope_hash = ${scopeHash}
      AND deleted_at IS NULL
    LIMIT 1
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
  // UPDATE-first: mockingbird-sqlite may allocate a stale rowid before ON CONFLICT
  // runs (UNIQUE on sync_engine_scope_meta.rowid). Skip allocate when the
  // row already exists (including soft-deleted). Fresh inserts pick
  // MAX(rowid)+1 explicitly so allocation does not consult the stale cache.
  const updated = await tx.run(sql`
    UPDATE sync_engine_scope_meta SET
      last_checkpoint = ${input.checkpoint},
      last_hash = ${input.hash},
      last_active_at = ${nowIso},
      updated_at = ${nowIso},
      deleted_at = NULL
    WHERE id = ${input.scopeHash}
  `);
  if (updated.changes > 0) return;

  await tx.run(sql`
    INSERT INTO sync_engine_scope_meta (
      rowid, id, scope_hash, last_active_at, last_checkpoint, last_hash,
      created_at, updated_at, deleted_at
    )
    VALUES (
      (SELECT COALESCE(MAX(rowid), 0) + 1 FROM sync_engine_scope_meta),
      ${input.scopeHash},
      ${input.scopeHash},
      ${nowIso},
      ${input.checkpoint},
      ${input.hash},
      ${nowIso},
      ${nowIso},
      ${null}
    )
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
      AND deleted_at IS NULL
    ORDER BY seq ASC
  `);
  activeSpan()?.setAttribute(ATTR.APP_SYNC_BATCH_SIZE, pending.length);
  for (const row of pending) {
    assert.ok(row.id.length > 0, 'sync_engine_mutations id must be non-empty');
    assert.ok(
      row.name.length > 0,
      'sync_engine_mutations name must be non-empty'
    );
  }
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

/**
 * After the CACHE tables were wiped (cleared data, an epoch bump), show the
 * device's queued writes again: re-apply them on the empty tables, as a merge
 * would, so what the person wrote and has not sent yet never disappears.
 */
export async function reapplyPendingAfterWipe(
  deps: MergeApplierDeps
): Promise<void> {
  await withMergeSingleFlight(deps.db, async () => {
    const changed = new Set<string>();
    await deps.db.transaction(async (tx) => {
      await observeSync('rebase', () => rebasePending(tx, deps, changed));
    });
    if (changed.size > 0)
      observeSyncNow('notify', () => deps.bus.emit([...changed]));
  });
}

async function runMerge(
  deps: MergeApplierDeps,
  input: MergeFullInput
): Promise<'applied' | 'stale'> {
  activeSpan()?.setAttribute(
    ATTR.APP_SYNC_ROWS,
    Object.values(input.tables).reduce((sum, rows) => sum + rows.length, 0)
  );
  activeSpan()?.setAttribute(
    ATTR.APP_SYNC_TABLES,
    Object.keys(input.tables).length
  );
  let applied = false;
  const changed = new Set<string>();
  await deps.db.transaction(async (tx) => {
    if (input.isCurrent?.() === false) return;
    if (await isStale(tx, input.scopeHash, input.checkpoint)) {
      return;
    }
    if (input.isCurrent?.() === false) return;
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
    await observeSync('rebase', () => rebasePending(tx, deps, changed));
    applied = true;
  });
  if (!applied) return 'stale';
  observeSyncNow('notify', () => deps.bus.emit([...changed]));
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
 * `raise` lifts the listed scopes' `last_checkpoint` in the same transaction
 * so no stale snapshot can slip in between the row apply and the fence.
 */
export type RowImageCheckpointRaise = {
  readonly checkpoint: string;
  readonly scopes: readonly string[];
};

export async function applyRowImages(
  deps: MergeApplierDeps,
  tables: Readonly<Record<string, readonly QueryRow[]>>,
  opts?: {
    readonly raise?: RowImageCheckpointRaise;
  }
): Promise<void> {
  const filtered: Record<string, readonly QueryRow[]> = {};
  for (const [table, rows] of Object.entries(tables)) {
    // Drop invalid names before merging row images.
    if (!isValidTableName(table)) continue;
    filtered[table] = filterDeviceOwnedRows(deps, rows);
  }
  await withMergeSingleFlight(deps.db, async () => {
    const changed = new Set<string>();
    await deps.db.transaction(async (tx) => {
      for (const [table, rows] of Object.entries(filtered)) {
        if (rows.length === 0) continue;
        await observeSync(
          'validate',
          () => assertCompleteNewRowImages(tx, table, rows),
          { [ATTR.APP_SYNC_BATCH_SIZE]: rows.length }
        );
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
      await clearOptimisticPeerRows(tx, filtered, deps.env.now().toISOString());
      await observeSync('rebase', () => rebasePending(tx, deps, changed));
      if (opts?.raise !== undefined) {
        await raiseScopeCheckpoints(
          tx,
          opts.raise.scopes,
          opts.raise.checkpoint,
          { now: () => deps.env.now().getTime() }
        );
      }
    });
    if (changed.size > 0)
      observeSyncNow('notify', () => deps.bus.emit([...changed]));
  });
}

/**
 * Drop scope checkpoint/hash only. Domain rows stay (unsubscribe / denied).
 */
export async function detachScope(
  deps: Pick<MergeApplierDeps, 'db' | 'bus' | 'env'>,
  scopeHash: string
): Promise<void> {
  const nowIso = deps.env.now().toISOString();
  await withMergeSingleFlight(deps.db, async () => {
    await deps.db.run(sql`
      UPDATE sync_engine_scope_meta
      SET deleted_at = ${nowIso}, updated_at = ${nowIso}
      WHERE scope_hash = ${scopeHash}
        AND deleted_at IS NULL
    `);
    observeSyncNow('notify', () => deps.bus.emit(['sync_engine_scope_meta']));
  });
}
