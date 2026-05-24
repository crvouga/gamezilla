/**
 * End-to-end reconciliation test against a real Postgres cluster. Skipped
 * unless `DB_URL` is set (e.g. `bun run --filter @pkgs/postgres dev`).
 *
 * Locks in the contracts that {@link migratePatchDbPostgres} must uphold
 * to keep the registry and the catalog in lock-step:
 *
 *   1. Idempotent re-runs converge — second `migratePatchDbPostgres` call
 *      right after the first reaches the same state (no schema drift).
 *   2. Schema mutations converge — adding a composite + removing an
 *      `.indexed()` tag drops the orphaned column + index and creates the
 *      new composite, all without dropping the per-entity table.
 *   3. NO COLUMN BLOAT — `snapshots__task` must carry only its own
 *      `gc_task__*` columns, never the `gc_item__*` columns from a
 *      sibling registered entity. This is the whole reason we abandoned
 *      declarative partitioning.
 *   4. Legacy detection — if Postgres still has a `relkind = 'p'`
 *      partitioned `snapshots` from before the architectural pivot,
 *      `migratePatchDbPostgres` drops it before applying the new layout.
 */
import { assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import { createLogger } from '@pkgs/logger';
import { SqlClientImplBunPostgres } from '@pkgs/sql-client/impl-bun-postgres';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  createEntitySchemaRegistry,
  defineEntitySchema,
} from '../schema';
import { migratePatchDbPostgres } from './migrate';
import { introspectPgLayout, probeSnapshotsRelKind } from './pg-introspect';
import {
  compositeIndexNameFor,
  generatedColumnNameFor,
  partitionTableName,
  singleColumnIndexNameFor,
} from './partitioning';

const DB_URL = process.env['DB_URL'] ?? '';
const HAS_DB = DB_URL.length > 0;

const taskNs = createAttrNamespace('task');
const TaskAttrV1 = {
  id: taskNs.text('id', (v) => String(v ?? '')).indexed({ unique: true }),
  rating: taskNs
    .integer('rating', (v) => Number(v ?? 0))
    .indexed({ sortable: true }),
  status: taskNs.text('status', (v) => String(v ?? '')).indexed(),
  title: taskNs.text('title', (v) => String(v ?? '')),
};

const TaskAttrV2 = {
  id: TaskAttrV1.id,
  rating: TaskAttrV1.rating,
  // `status.indexed()` removed → its gen column + single index must drop.
  status: taskNs.text('status', (v) => String(v ?? '')),
  title: TaskAttrV1.title,
};

const itemNs = createAttrNamespace('item');
const ItemAttr = {
  sku: itemNs.text('sku', (v) => String(v ?? '')).indexed(),
};

const TASK_TABLE = partitionTableName('task');
const ITEM_TABLE = partitionTableName('item');
const TASK_RATING_COL = generatedColumnNameFor('task', TaskAttrV1.rating.key);
const TASK_STATUS_COL = generatedColumnNameFor('task', TaskAttrV1.status.key);
const TASK_ID_COL = generatedColumnNameFor('task', TaskAttrV1.id.key);
const ITEM_SKU_COL = generatedColumnNameFor('item', ItemAttr.sku.key);
const RATING_IDX = singleColumnIndexNameFor(TASK_RATING_COL);
const STATUS_IDX = singleColumnIndexNameFor(TASK_STATUS_COL);
const COMPOSITE_IDX = compositeIndexNameFor('task', 'rating-status');

/** Drop every patch-db symbol we might find. Has to handle two shapes for
 *  `snapshots`: either a view (new architecture) or a table (legacy
 *  partitioned design / standalone-table fallback). Postgres rejects
 *  `DROP VIEW` against a table and vice versa, so we probe first. */
async function dropAllPatchDbObjects(sqlClient: SqlClient): Promise<void> {
  const kind = await probeSnapshotsRelKind(sqlClient);
  if (kind === 'view') {
    await sqlClient.run('DROP VIEW IF EXISTS snapshots CASCADE');
  } else if (kind !== 'absent') {
    await sqlClient.run('DROP TABLE IF EXISTS snapshots CASCADE');
  }
  await sqlClient.run('DROP TABLE IF EXISTS snapshots__task CASCADE');
  await sqlClient.run('DROP TABLE IF EXISTS snapshots__item CASCADE');
  await sqlClient.run(
    'DROP TABLE IF EXISTS snapshots__legacy_partition CASCADE'
  );
  await sqlClient.run('DROP TABLE IF EXISTS patches CASCADE');
}

describe.skipIf(!HAS_DB)('migratePatchDbPostgres: reconcile integration', () => {
  let sqlClient: SqlClient;
  const logger = createLogger({ name: 'reconcile-it', level: 'silent' });

  beforeAll(async () => {
    sqlClient = SqlClientImplBunPostgres.connect(DB_URL);
    await sqlClient.connect();
  });

  afterAll(async () => {
    if (sqlClient !== undefined) {
      await dropAllPatchDbObjects(sqlClient).catch(() => {});
      await sqlClient.disconnect();
    }
  });

  beforeEach(async () => {
    await dropAllPatchDbObjects(sqlClient);
  });

  test('initial migrate creates per-entity table + gen cols + per-col idx + per-table GIN + view; second migrate reaches the same state', async () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttrV1 })
      )
      .freeze();
    await migratePatchDbPostgres({ sqlClient, logger, registry });
    const after1 = await introspectPgLayout(sqlClient);
    expect(after1.tableNames).toEqual([TASK_TABLE]);
    // 3 `.indexed()` scalar tags → 3 gen cols + 3 per-col indexes ON the task table.
    expect(new Set(after1.generatedColumnsByTable.get(TASK_TABLE))).toEqual(
      new Set([TASK_ID_COL, TASK_RATING_COL, TASK_STATUS_COL])
    );
    expect(
      new Set(after1.singleIndexes.map((i) => i.indexName))
    ).toEqual(
      new Set([
        singleColumnIndexNameFor(TASK_ID_COL),
        RATING_IDX,
        STATUS_IDX,
      ])
    );
    expect(after1.compositeIndexes).toEqual([]);
    // Per-table GIN landed.
    expect(
      after1.ginIndexes.some(
        (g) => g.tableName === TASK_TABLE && g.indexName === 'pdb_gin_task__attrs'
      )
    ).toBe(true);
    // `snapshots` is a VIEW now, not a partitioned parent.
    expect(await probeSnapshotsRelKind(sqlClient)).toBe('view');

    // Second migrate — same registry, same catalog → same state.
    await migratePatchDbPostgres({ sqlClient, logger, registry });
    const after2 = await introspectPgLayout(sqlClient);
    expect([...after2.tableNames].sort()).toEqual(
      [...after1.tableNames].sort()
    );
    expect(
      [...(after2.generatedColumnsByTable.get(TASK_TABLE) ?? [])].sort()
    ).toEqual([...(after1.generatedColumnsByTable.get(TASK_TABLE) ?? [])].sort());
    expect(after2.singleIndexes.map((i) => i.indexName).sort()).toEqual(
      after1.singleIndexes.map((i) => i.indexName).sort()
    );
    expect(after2.compositeIndexes.length).toBe(0);
    expect(after2.ginIndexes.map((g) => g.indexName).sort()).toEqual(
      after1.ginIndexes.map((g) => g.indexName).sort()
    );
  });

  test('NO COLUMN BLOAT: `snapshots__task` carries only its own gen cols, never `gc_item__*`', async () => {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttrV1 })
      )
      .register(defineEntitySchema({ entityType: 'item', attributes: ItemAttr }))
      .freeze();
    await migratePatchDbPostgres({ sqlClient, logger, registry });
    const live = await introspectPgLayout(sqlClient);
    // Both per-entity tables exist.
    expect(new Set(live.tableNames)).toEqual(new Set([TASK_TABLE, ITEM_TABLE]));
    // `snapshots__task` has its three task gen cols and NO item cols.
    const taskCols = live.generatedColumnsByTable.get(TASK_TABLE) ?? new Set();
    expect(taskCols.has(TASK_ID_COL)).toBe(true);
    expect(taskCols.has(TASK_RATING_COL)).toBe(true);
    expect(taskCols.has(TASK_STATUS_COL)).toBe(true);
    expect(taskCols.has(ITEM_SKU_COL)).toBe(false);
    // Symmetrically, `snapshots__item` has only the item gen col.
    const itemCols = live.generatedColumnsByTable.get(ITEM_TABLE) ?? new Set();
    expect(itemCols.has(ITEM_SKU_COL)).toBe(true);
    expect(itemCols.has(TASK_ID_COL)).toBe(false);
    expect(itemCols.has(TASK_RATING_COL)).toBe(false);
  });

  test('schema mutation: removing an .indexed() tag drops its gen col + idx; adding a composite creates it', async () => {
    const v1 = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttrV1 })
      )
      .freeze();
    await migratePatchDbPostgres({ sqlClient, logger, registry: v1 });

    const v2 = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: TaskAttrV2,
          composite: [
            {
              name: 'rating-status',
              fields: [
                { tag: TaskAttrV1.rating, direction: 'desc' },
                // status now unindexed, can't be in composite; reuse rating
                // both ways instead — composite resolver requires .indexed().
                { tag: TaskAttrV1.rating, direction: 'asc' },
              ],
            },
          ],
        })
      )
      .freeze();
    await migratePatchDbPostgres({ sqlClient, logger, registry: v2 });

    const after = await introspectPgLayout(sqlClient);
    expect(after.tableNames).toEqual([TASK_TABLE]);
    const taskCols = after.generatedColumnsByTable.get(TASK_TABLE) ?? new Set();
    // `status` gen col + its idx are gone.
    expect(taskCols.has(TASK_STATUS_COL)).toBe(false);
    expect(
      after.singleIndexes.some((i) => i.indexName === STATUS_IDX)
    ).toBe(false);
    // `rating` survives because it stayed `.indexed()`.
    expect(taskCols.has(TASK_RATING_COL)).toBe(true);
    expect(
      after.singleIndexes.some((i) => i.indexName === RATING_IDX)
    ).toBe(true);
    // New composite landed under the `pdb_cidx_` namespace.
    expect(
      after.compositeIndexes.some(
        (i) => i.tableName === TASK_TABLE && i.indexName === COMPOSITE_IDX
      )
    ).toBe(true);
  });

  test('removing an entity type from the registry leaves the per-entity table in place (additive-only)', async () => {
    const both = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttrV1 })
      )
      .register(defineEntitySchema({ entityType: 'item', attributes: ItemAttr }))
      .freeze();
    await migratePatchDbPostgres({ sqlClient, logger, registry: both });
    const initial = await introspectPgLayout(sqlClient);
    assert.ok(
      initial.tableNames.includes(ITEM_TABLE),
      'item per-entity table must exist after initial migrate'
    );

    const onlyTask = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttrV1 })
      )
      .freeze();
    await migratePatchDbPostgres({ sqlClient, logger, registry: onlyTask });
    const after = await introspectPgLayout(sqlClient);
    // `snapshots__item` survives even though `item` was dropped from the
    // registry — the reconciler logs but does not drop per-entity tables.
    expect(after.tableNames.includes(ITEM_TABLE)).toBe(true);
    expect(after.tableNames.includes(TASK_TABLE)).toBe(true);
  });

  test('legacy detection: a pre-existing partitioned `snapshots` is dropped before the new layout lands', async () => {
    // Simulate the pre-pivot state: create `snapshots` as a partitioned
    // parent with a child partition so we know `migratePatchDbPostgres`
    // actually nukes the cluster (not just renames it).
    await sqlClient.run(`
      CREATE TABLE snapshots (
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        attributes JSONB NOT NULL DEFAULT '{}',
        PRIMARY KEY (entity_type, entity_id)
      ) PARTITION BY LIST (entity_type)
    `);
    await sqlClient.run(
      `CREATE TABLE snapshots__legacy_partition PARTITION OF snapshots FOR VALUES IN ('legacy')`
    );
    expect(await probeSnapshotsRelKind(sqlClient)).toBe('partitioned');

    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttrV1 })
      )
      .freeze();
    await migratePatchDbPostgres({ sqlClient, logger, registry });
    // After migrate: `snapshots` is the new view, the legacy partition is
    // gone (the partitioned parent's children get cascaded), and the new
    // per-entity `snapshots__task` exists.
    expect(await probeSnapshotsRelKind(sqlClient)).toBe('view');
    const after = await introspectPgLayout(sqlClient);
    expect(after.tableNames).toContain(TASK_TABLE);
    expect(after.tableNames).not.toContain('snapshots__legacy_partition');
  });
});
