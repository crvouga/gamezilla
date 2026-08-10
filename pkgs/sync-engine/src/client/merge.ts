import { assert } from '@pkgs/assert';
import { ident, join, sql, unsafe, type Value } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type {
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../mutations/core/types';
import { wrapMutationDb } from '../mutations/shared/wrap-mutation-db';
import type { TableChangeBus } from '../queries/client/table-change-bus';
import type { QueryRow } from '../queries/core/types';
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

function assertTableName(table: string): void {
  assert.ok(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table), `bad table: ${table}`);
}

/**
 * Postgres jsonb / JSON wire values arrive as objects or arrays. expo-sqlite
 * only accepts string | number | null | Uint8Array binds.
 */
function sqliteWireValue(value: unknown): Value {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function tableColumns(
  tx: SqlClient,
  table: string
): Promise<readonly string[]> {
  assertTableName(table);
  const info = await tx.query(
    unsafe<{ name: string }>(`PRAGMA table_info("${table}")`)
  );
  return info.map((c) => c.name);
}

function withManagedDefaults(
  row: QueryRow,
  localCols: readonly string[],
  env: MutationEnv
): QueryRow {
  const filled: Record<string, unknown> = { ...row };
  const nowIso = env.now().toISOString();
  if (localCols.includes('id') && filled['id'] == null) {
    filled['id'] = env.createId();
  }
  if (localCols.includes('created_at') && filled['created_at'] == null) {
    filled['created_at'] = nowIso;
  }
  if (localCols.includes('updated_at') && filled['updated_at'] == null) {
    filled['updated_at'] = nowIso;
  }
  return filled as QueryRow;
}

/** Upsert intersecting columns verbatim (including `deleted_at`). */
async function upsertRowIntersect(args: {
  readonly tx: SqlClient;
  readonly table: string;
  readonly row: QueryRow;
  readonly localCols: readonly string[];
  readonly env: MutationEnv;
}): Promise<void> {
  const { tx, table, row, localCols, env } = args;
  assertTableName(table);
  const filled = withManagedDefaults(row, localCols, env);
  const cols = localCols.filter((c) =>
    Object.prototype.hasOwnProperty.call(filled, c)
  );
  assert.ok(cols.includes('id'), `${table}: id required`);

  const colIdents = cols.map((c) => ident(c));
  const valueFrags = cols.map((c) => sql`${sqliteWireValue(filled[c])}`);
  const assignments = cols
    .filter((c) => c !== 'id')
    .map((c) => sql`${ident(c)} = excluded.${ident(c)}`);

  if (assignments.length === 0) {
    await tx.run(sql`
      INSERT INTO ${ident(table)} (${join(colIdents)})
      VALUES (${join(valueFrags)})
      ON CONFLICT (id) DO NOTHING
    `);
    return;
  }

  await tx.run(sql`
    INSERT INTO ${ident(table)} (${join(colIdents)})
    VALUES (${join(valueFrags)})
    ON CONFLICT (id) DO UPDATE SET ${join(assignments)}
  `);
}

async function mergeTable(
  tx: SqlClient,
  table: string,
  rows: readonly QueryRow[],
  env: MutationEnv
): Promise<boolean> {
  const cols = await tableColumns(tx, table);
  if (cols.length === 0) return false;
  for (const row of rows) {
    const id = row['id'];
    assert.ok(typeof id === 'string' && id.length > 0, 'row id required');
    await upsertRowIntersect({ tx, table, row, localCols: cols, env });
  }
  return true;
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

async function touchScopeMeta(
  tx: SqlClient,
  input: MergeFullInput,
  now: () => Date
): Promise<void> {
  const nowIso = now().toISOString();
  await tx.run(sql`
    INSERT INTO _scope_meta (scope_hash, last_active_at, last_checkpoint, last_hash)
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
    FROM _mutations
    WHERE client_id = ${deps.clientId}
    ORDER BY seq ASC
  `);
  for (const row of pending) {
    const m = deps.registry[row.name] as Mutation<unknown> | undefined;
    if (m === undefined) continue;
    let parsed: unknown;
    try {
      parsed = m.args.parse(JSON.parse(row.args));
    } catch {
      continue;
    }
    try {
      const env = {
        ...deps.env,
        now: () => new Date(row.created_at),
      };
      const wrapped = wrapMutationDb(tx, env);
      await m.run({ tx: wrapped.tx, env }, parsed);
      for (const t of wrapped.getCapture().tables) changed.add(t);
    } catch {
      // Keep queued; hide optimistic effect until upload/reject.
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
    if (await isStale(tx, input.scopeHash, input.checkpoint)) return;
    for (const [table, rows] of Object.entries(input.tables)) {
      const ok = await mergeTable(tx, table, rows, deps.env);
      if (ok) changed.add(table);
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
 * Apply post-replay row images from a push through the same upsert +
 * rebase path as a full snapshot merge.
 *
 * Intentionally does **not** update `_scope_meta.last_hash`: the hash echoes
 * the server's last full-snapshot content so `not_modified` stays sound. A
 * rows-apply changes local content without claiming a full snapshot.
 */
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

export async function applyRowImages(
  deps: MergeApplierDeps,
  tables: Readonly<Record<string, readonly QueryRow[]>>
): Promise<void> {
  const filtered: Record<string, readonly QueryRow[]> = {};
  for (const [table, rows] of Object.entries(tables)) {
    filtered[table] = filterDeviceOwnedRows(deps, rows);
  }
  await withMergeSingleFlight(deps.db, async () => {
    const changed = new Set<string>();
    await deps.db.transaction(async (tx) => {
      for (const [table, rows] of Object.entries(filtered)) {
        if (rows.length === 0) continue;
        try {
          const ok = await mergeTable(tx, table, rows, deps.env);
          if (ok) changed.add(table);
        } catch {
          // Table absent from local schema — skip (mirrors snapshot tolerance).
        }
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
      DELETE FROM _scope_meta WHERE scope_hash = ${scopeHash}
    `);
    deps.bus.emit(['_scope_meta']);
  });
}
