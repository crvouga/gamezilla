/**
 * Pure unit tests for {@link diffPgLayout} + the orphaned-table warn path
 * + the DDL shape emitted by {@link applyPgLayoutDiff}. No real Postgres
 * — the SqlClient is a hand-rolled fake that records every emitted DDL
 * string so the tests can assert on the exact statements produced.
 */
import { assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client/interface';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createEntitySchemaRegistry, defineEntitySchema } from '../schema';
import type { LivePgLayout, SnapshotsRelKind } from './pg-introspect';
import {
  compositeIndexNameFor,
  generatedColumnNameFor,
  ginIndexNameFor,
  partitionTableName,
  singleColumnIndexNameFor,
  UNREGISTERED_SNAPSHOT_TABLE,
} from './partitioning';
import { computeDesiredPgLayout } from './pg-layout';
import { applyPgLayoutDiff, diffPgLayout } from './pg-reconcile';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
});
afterAll(() => {
  disposeCrashHandler();
});

const taskNs = createAttrNamespace('task');
const TaskAttr = {
  id: taskNs.text('id', (v) => String(v ?? '')).indexed({ unique: true }),
  rating: taskNs
    .integer('rating', (v) => Number(v ?? 0))
    .indexed({ sortable: true }),
  status: taskNs.text('status', (v) => String(v ?? '')).indexed(),
  title: taskNs.text('title', (v) => String(v ?? '')),
};

const itemNs = createAttrNamespace('item');
const ItemAttr = {
  sku: itemNs.text('sku', (v) => String(v ?? '')).indexed(),
};

const TASK_TABLE = partitionTableName('task');
const TASK_RATING_COL = generatedColumnNameFor('task', TaskAttr.rating.key);
const TASK_RATING_IDX = singleColumnIndexNameFor(TASK_RATING_COL);
const TASK_STATUS_COL = generatedColumnNameFor('task', TaskAttr.status.key);
const TASK_ID_COL = generatedColumnNameFor('task', TaskAttr.id.key);
const TASK_GIN_IDX = ginIndexNameFor('task');
const ITEM_TABLE = partitionTableName('item');
const ITEM_SKU_COL = generatedColumnNameFor('item', ItemAttr.sku.key);

function buildTaskLayout(): ReturnType<typeof computeDesiredPgLayout> {
  return computeDesiredPgLayout(
    createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttr })
      )
      .freeze()
  );
}

function buildTaskAndItemLayout(): ReturnType<typeof computeDesiredPgLayout> {
  return computeDesiredPgLayout(
    createEntitySchemaRegistry()
      .register(
        defineEntitySchema({ entityType: 'task', attributes: TaskAttr })
      )
      .register(
        defineEntitySchema({ entityType: 'item', attributes: ItemAttr })
      )
      .freeze()
  );
}

const EMPTY_LIVE: LivePgLayout = Object.freeze({
  tableNames: [],
  generatedColumnsByTable: new Map<string, ReadonlySet<string>>(),
  singleIndexes: [],
  compositeIndexes: [],
  ginIndexes: [],
});

describe('diffPgLayout: empty live layout (initial migration)', () => {
  test('produces ADDs only — no drops', () => {
    const desired = buildTaskLayout();
    const diff = diffPgLayout(desired, EMPTY_LIVE);
    expect(diff.tablesToCreate.length).toBe(2);
    expect(diff.tablesToCreate.map((t) => t.tableName).sort()).toEqual(
      [TASK_TABLE, UNREGISTERED_SNAPSHOT_TABLE].sort()
    );
    expect(diff.orphanedTableNames).toEqual([]);
    expect(diff.generatedColumnsToAdd.length).toBe(1);
    expect(diff.generatedColumnsToAdd[0]?.tableName).toBe(TASK_TABLE);
    expect(diff.generatedColumnsToAdd[0]?.specs.length).toBe(3);
    expect(diff.generatedColumnsToDrop).toEqual([]);
    expect(diff.singleIndexesToAdd.length).toBe(3);
    expect(diff.singleIndexesToDrop).toEqual([]);
    expect(diff.compositeIndexesToAdd).toEqual([]);
    expect(diff.compositeIndexesToDrop).toEqual([]);
    expect(diff.ginIndexesToAdd.length).toBe(2);
    expect(diff.viewBranches.length).toBe(2);
  });
});

function liveFromDesired(
  desired: ReturnType<typeof computeDesiredPgLayout>
): LivePgLayout {
  const tableNames: string[] = [];
  const generatedColumnsByTable = new Map<string, ReadonlySet<string>>();
  const singleIndexes: { tableName: string; indexName: string }[] = [];
  const compositeIndexes: { tableName: string; indexName: string }[] = [];
  const ginIndexes: { tableName: string; indexName: string }[] = [];
  for (const table of desired.tables.values()) {
    tableNames.push(table.tableName);
    generatedColumnsByTable.set(
      table.tableName,
      new Set([...table.generatedColumns.keys()])
    );
    for (const s of table.singleIndexes.values()) {
      singleIndexes.push({
        tableName: table.tableName,
        indexName: s.indexName,
      });
    }
    for (const c of table.compositeIndexes.values()) {
      compositeIndexes.push({
        tableName: table.tableName,
        indexName: c.indexName,
      });
    }
    if (table.ginIndexName !== null) {
      ginIndexes.push({
        tableName: table.tableName,
        indexName: table.ginIndexName,
      });
    }
  }
  return Object.freeze({
    tableNames,
    generatedColumnsByTable,
    singleIndexes,
    compositeIndexes,
    ginIndexes,
  });
}

describe('diffPgLayout: live equals desired (idempotent re-run)', () => {
  test('emits no DDL', () => {
    const desired = buildTaskLayout();
    const live = liveFromDesired(desired);
    const diff = diffPgLayout(desired, live);
    expect(diff.tablesToCreate).toEqual([]);
    expect(diff.orphanedTableNames).toEqual([]);
    expect(diff.generatedColumnsToAdd).toEqual([]);
    expect(diff.generatedColumnsToDrop).toEqual([]);
    expect(diff.singleIndexesToAdd).toEqual([]);
    expect(diff.singleIndexesToDrop).toEqual([]);
    expect(diff.compositeIndexesToAdd).toEqual([]);
    expect(diff.compositeIndexesToDrop).toEqual([]);
    expect(diff.ginIndexesToAdd).toEqual([]);
    expect(diff.ginIndexesToDrop).toEqual([]);
    expect(diff.viewBranches.length).toBe(2);
  });
});

describe('diffPgLayout: drops orphaned objects', () => {
  test('orphan generated column + its companion single index appear in drops on the SAME table', () => {
    const desired = buildTaskLayout();
    const baseline = liveFromDesired(desired);
    const orphanCol = 'gc_task__obsolete';
    const orphanIdx = singleColumnIndexNameFor(orphanCol);
    const updatedCols = new Map(baseline.generatedColumnsByTable);
    updatedCols.set(
      TASK_TABLE,
      new Set([
        ...(baseline.generatedColumnsByTable.get(TASK_TABLE) ?? []),
        orphanCol,
      ])
    );
    const live: LivePgLayout = {
      tableNames: baseline.tableNames,
      generatedColumnsByTable: updatedCols,
      singleIndexes: [
        ...baseline.singleIndexes,
        { tableName: TASK_TABLE, indexName: orphanIdx },
      ],
      compositeIndexes: baseline.compositeIndexes,
      ginIndexes: baseline.ginIndexes,
    };
    const diff = diffPgLayout(desired, live);
    expect(diff.generatedColumnsToDrop).toEqual([
      { tableName: TASK_TABLE, columnNames: [orphanCol] },
    ]);
    expect(diff.singleIndexesToDrop).toEqual([
      { tableName: TASK_TABLE, indexName: orphanIdx },
    ]);
  });

  test('orphan gen col on table A is dropped from table A only (not from sibling tables)', () => {
    const desired = buildTaskAndItemLayout();
    const baseline = liveFromDesired(desired);
    const orphanOnTask = 'gc_item__sku'; // wrong slug, stuck on snapshots__task
    const updatedCols = new Map(baseline.generatedColumnsByTable);
    updatedCols.set(
      TASK_TABLE,
      new Set([
        ...(baseline.generatedColumnsByTable.get(TASK_TABLE) ?? []),
        orphanOnTask,
      ])
    );
    const live: LivePgLayout = {
      tableNames: baseline.tableNames,
      generatedColumnsByTable: updatedCols,
      singleIndexes: baseline.singleIndexes,
      compositeIndexes: baseline.compositeIndexes,
      ginIndexes: baseline.ginIndexes,
    };
    const diff = diffPgLayout(desired, live);
    const taskDrop = diff.generatedColumnsToDrop.find(
      (b) => b.tableName === TASK_TABLE
    );
    const itemDrop = diff.generatedColumnsToDrop.find(
      (b) => b.tableName === ITEM_TABLE
    );
    expect(taskDrop?.columnNames).toEqual([orphanOnTask]);
    expect(itemDrop).toBeUndefined();
    // Item table's own gen col (`ITEM_SKU_COL`) is untouched.
    const itemAdd = diff.generatedColumnsToAdd.find(
      (b) => b.tableName === ITEM_TABLE
    );
    expect(itemAdd).toBeUndefined();
    void ITEM_SKU_COL;
  });

  test('orphan composite index appears in drops on its table', () => {
    const desired = buildTaskLayout();
    const baseline = liveFromDesired(desired);
    const live: LivePgLayout = {
      ...baseline,
      compositeIndexes: [
        {
          tableName: TASK_TABLE,
          indexName: 'pdb_cidx_task__obsolete_combo',
        },
      ],
    };
    const diff = diffPgLayout(desired, live);
    expect(diff.compositeIndexesToDrop).toEqual([
      {
        tableName: TASK_TABLE,
        indexName: 'pdb_cidx_task__obsolete_combo',
      },
    ]);
  });

  test('orphan per-entity table is reported but not enqueued for drop', () => {
    const desired = buildTaskLayout();
    const live: LivePgLayout = {
      tableNames: [TASK_TABLE, 'snapshots__legacy_entity'],
      generatedColumnsByTable: new Map<string, ReadonlySet<string>>(),
      singleIndexes: [],
      compositeIndexes: [],
      ginIndexes: [],
    };
    const diff = diffPgLayout(desired, live);
    expect(diff.orphanedTableNames).toEqual(['snapshots__legacy_entity']);
  });
});

describe('diffPgLayout: schema mutation (add composite, drop indexed attr)', () => {
  test('emits ADD composite + DROP gen column + DROP its single idx in one diff', () => {
    const desired = computeDesiredPgLayout(
      createEntitySchemaRegistry()
        .register(
          defineEntitySchema({
            entityType: 'task',
            attributes: {
              id: TaskAttr.id,
              rating: TaskAttr.rating,
              status: TaskAttr.status,
              title: TaskAttr.title,
            },
            composite: [
              {
                name: 'rating-status',
                fields: [
                  { tag: TaskAttr.rating, direction: 'desc' },
                  { tag: TaskAttr.status },
                ],
              },
            ],
          })
        )
        .freeze()
    );
    // Live = desired + one stale `gc_task__legacy` gen col + its idx.
    const baseline = liveFromDesired(desired);
    const stale = 'gc_task__legacy';
    const staleIdx = singleColumnIndexNameFor(stale);
    const updatedCols = new Map(baseline.generatedColumnsByTable);
    updatedCols.set(
      TASK_TABLE,
      new Set([
        ...(baseline.generatedColumnsByTable.get(TASK_TABLE) ?? []),
        stale,
      ])
    );
    const live: LivePgLayout = {
      tableNames: baseline.tableNames,
      generatedColumnsByTable: updatedCols,
      singleIndexes: [
        ...baseline.singleIndexes,
        { tableName: TASK_TABLE, indexName: staleIdx },
      ],
      compositeIndexes: [],
      ginIndexes: baseline.ginIndexes,
    };
    const diff = diffPgLayout(desired, live);
    expect(diff.generatedColumnsToAdd).toEqual([]);
    expect(diff.generatedColumnsToDrop).toEqual([
      { tableName: TASK_TABLE, columnNames: [stale] },
    ]);
    expect(diff.singleIndexesToDrop).toEqual([
      { tableName: TASK_TABLE, indexName: staleIdx },
    ]);
    expect(diff.compositeIndexesToAdd.length).toBe(1);
    const composite = diff.compositeIndexesToAdd[0];
    expect(composite?.tableName).toBe(TASK_TABLE);
    expect(composite?.spec.indexName).toBe(
      compositeIndexNameFor('task', 'rating-status')
    );
  });
});

// ---------- applyPgLayoutDiff: hand-rolled fake SqlClient ------------

type FakeLogger = {
  readonly warnings: { msg: string; ctx?: Record<string, unknown> }[];
  debug(): void;
  info(): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(): void;
  child(): FakeLogger;
};

function createFakeLogger(): FakeLogger {
  const warnings: { msg: string; ctx?: Record<string, unknown> }[] = [];
  const logger: FakeLogger = {
    warnings,
    debug: () => {},
    info: () => {},
    warn: (msg, ctx) => {
      warnings.push(ctx === undefined ? { msg } : { msg, ctx });
    },
    error: () => {},
    child: () => logger,
  };
  return logger;
}

class RecordingSqlClient implements SqlClient {
  readonly statements: string[] = [];
  snapshotsRelKind: SnapshotsRelKind = 'absent';
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    if (sql.includes("c.relname = 'snapshots'")) {
      if (this.snapshotsRelKind === 'absent') return [];
      const relkind =
        this.snapshotsRelKind === 'view'
          ? 'v'
          : this.snapshotsRelKind === 'partitioned'
            ? 'p'
            : 'r';
      return [{ relkind }] as T[];
    }
    return [];
  }
  async run(sql: string): Promise<RunResult> {
    this.statements.push(sql);
    return { changes: 0, lastInsertRowid: 0 };
  }
  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return await fn(this);
  }
  prepare(_sql: string): PreparedStatement {
    void _sql;
    return {
      query: async <T = Record<string, unknown>>() => [] as T[],
      run: async () => ({ changes: 0, lastInsertRowid: 0 }) satisfies RunResult,
    };
  }
}

describe('applyPgLayoutDiff: orphaned table emits a warn but no DROP TABLE', () => {
  test('logs warn, summary records orphan; no DROP TABLE in the recorded statements', async () => {
    const desired = computeDesiredPgLayout(
      createEntitySchemaRegistry().freeze()
    );
    const live: LivePgLayout = {
      tableNames: ['snapshots__legacy_entity'],
      generatedColumnsByTable: new Map<string, ReadonlySet<string>>(),
      singleIndexes: [],
      compositeIndexes: [],
      ginIndexes: [],
    };
    const diff = diffPgLayout(desired, live);
    const logger = createFakeLogger();
    const sqlClient = new RecordingSqlClient();
    const summary = await applyPgLayoutDiff(sqlClient, diff, logger);
    expect(summary.orphanedTablesKept).toBe(1);
    expect(logger.warnings.length).toBe(1);
    expect(logger.warnings[0]?.msg).toMatch(
      /orphaned per-entity snapshot table/i
    );
    expect(sqlClient.statements.some((s) => /^DROP TABLE/i.test(s))).toBe(
      false
    );
  });
});

describe('applyPgLayoutDiff: emits expected DDL shape on full add path', () => {
  test('CREATE TABLE w/ CHECK + ALTER ADD COLUMN (batched) + CREATE INDEX per col + CREATE VIEW', async () => {
    const desired = buildTaskLayout();
    const diff = diffPgLayout(desired, EMPTY_LIVE);
    const logger = createFakeLogger();
    const sqlClient = new RecordingSqlClient();
    await applyPgLayoutDiff(sqlClient, diff, logger);
    // Fresh DB: no prior `snapshots` relation, so no drop is emitted.
    expect(
      sqlClient.statements.some((s) => /^DROP (VIEW|TABLE)/i.test(s))
    ).toBe(false);
    // CREATE TABLE with CHECK predicate (standalone — no `PARTITION OF`).
    expect(
      sqlClient.statements.some(
        (s) =>
          new RegExp(`CREATE TABLE IF NOT EXISTS ${TASK_TABLE}`).test(s) &&
          /CHECK\s*\(\s*entity_type\s*=\s*'task'\s*\)/.test(s) &&
          !/PARTITION OF/i.test(s)
      )
    ).toBe(true);
    // Generated columns added per-table (not on parent `snapshots`).
    expect(
      sqlClient.statements.some(
        (s) =>
          new RegExp(`^ALTER TABLE ${TASK_TABLE} ADD COLUMN`).test(s) &&
          s.includes(TASK_RATING_COL) &&
          s.includes(TASK_STATUS_COL) &&
          s.includes(TASK_ID_COL)
      )
    ).toBe(true);
    expect(
      sqlClient.statements.some((s) =>
        /ALTER TABLE snapshots ADD COLUMN/.test(s)
      )
    ).toBe(false);
    // Per-column btree on the per-entity table.
    expect(
      sqlClient.statements.some((s) =>
        new RegExp(
          `CREATE INDEX IF NOT EXISTS ${TASK_RATING_IDX} ON ${TASK_TABLE}`
        ).test(s)
      )
    ).toBe(true);
    // Per-table GIN.
    expect(
      sqlClient.statements.some((s) =>
        new RegExp(
          `CREATE INDEX IF NOT EXISTS ${TASK_GIN_IDX} ON ${TASK_TABLE} USING GIN`
        ).test(s)
      )
    ).toBe(true);
    // View rebuilt with one UNION ALL branch.
    expect(
      sqlClient.statements.some(
        (s) =>
          /CREATE VIEW snapshots AS/i.test(s) &&
          new RegExp(`FROM ${TASK_TABLE}`).test(s)
      )
    ).toBe(true);
  });

  test('idempotent re-run emits only the DROP VIEW + CREATE VIEW pair', async () => {
    const desired = buildTaskLayout();
    const live = liveFromDesired(desired);
    const diff = diffPgLayout(desired, live);
    const logger = createFakeLogger();
    const sqlClient = new RecordingSqlClient();
    sqlClient.snapshotsRelKind = 'view';
    await applyPgLayoutDiff(sqlClient, diff, logger);
    // Two statements: drop the prior view + create the new (identical) one.
    // The reconciler rebuilds the view on every run because doing so is
    // cheap and lets us not introspect view bodies for drift.
    expect(sqlClient.statements.length).toBe(2);
    expect(sqlClient.statements[0]).toMatch(/^DROP VIEW IF EXISTS snapshots/i);
    expect(sqlClient.statements[1]).toMatch(/^CREATE VIEW snapshots AS/i);
  });

  test('empty registry still creates unregistered fallback + view', async () => {
    const desired = computeDesiredPgLayout(
      createEntitySchemaRegistry().freeze()
    );
    const diff = diffPgLayout(desired, EMPTY_LIVE);
    const logger = createFakeLogger();
    const sqlClient = new RecordingSqlClient();
    await applyPgLayoutDiff(sqlClient, diff, logger);
    expect(
      sqlClient.statements.some((s) =>
        new RegExp(
          `CREATE TABLE IF NOT EXISTS ${UNREGISTERED_SNAPSHOT_TABLE}`
        ).test(s)
      )
    ).toBe(true);
    expect(sqlClient.statements.some((s) => /^CREATE VIEW/i.test(s))).toBe(
      true
    );
  });

  test('legacy plain-table `snapshots` is dropped with DROP TABLE before CREATE VIEW', async () => {
    const desired = buildTaskLayout();
    const diff = diffPgLayout(desired, EMPTY_LIVE);
    const logger = createFakeLogger();
    const sqlClient = new RecordingSqlClient();
    sqlClient.snapshotsRelKind = 'other';
    await applyPgLayoutDiff(sqlClient, diff, logger);
    expect(sqlClient.statements[0]).toMatch(/^DROP TABLE IF EXISTS snapshots/i);
    expect(
      sqlClient.statements.some((s) => /^CREATE VIEW snapshots AS/i.test(s))
    ).toBe(true);
  });

  test('multi-entity registry produces one UNION ALL branch per per-entity table', async () => {
    const desired = buildTaskAndItemLayout();
    const diff = diffPgLayout(desired, EMPTY_LIVE);
    const logger = createFakeLogger();
    const sqlClient = new RecordingSqlClient();
    await applyPgLayoutDiff(sqlClient, diff, logger);
    const viewStmt = sqlClient.statements.find((s) =>
      /^CREATE VIEW snapshots AS/i.test(s)
    );
    assert.defined(viewStmt, 'CREATE VIEW snapshots must be emitted');
    expect(viewStmt).toContain(`FROM ${TASK_TABLE}`);
    expect(viewStmt).toContain(`FROM ${ITEM_TABLE}`);
    expect(viewStmt).toContain(`FROM ${UNREGISTERED_SNAPSHOT_TABLE}`);
    expect((viewStmt.match(/UNION ALL/g) ?? []).length).toBe(2);
  });
});

describe('applyPgLayoutDiff: composite index DDL', () => {
  test('emits CREATE INDEX with multi-column list and direction modifiers', async () => {
    const desired = computeDesiredPgLayout(
      createEntitySchemaRegistry()
        .register(
          defineEntitySchema({
            entityType: 'task',
            attributes: TaskAttr,
            composite: [
              {
                name: 'rating-status',
                fields: [
                  { tag: TaskAttr.rating, direction: 'desc' },
                  { tag: TaskAttr.status, direction: 'asc' },
                ],
              },
            ],
          })
        )
        .freeze()
    );
    const diff = diffPgLayout(desired, EMPTY_LIVE);
    const logger = createFakeLogger();
    const sqlClient = new RecordingSqlClient();
    await applyPgLayoutDiff(sqlClient, diff, logger);
    const expectedIndex = compositeIndexNameFor('task', 'rating-status');
    expect(
      sqlClient.statements.some(
        (s) =>
          new RegExp(
            `CREATE INDEX IF NOT EXISTS ${expectedIndex} ON ${TASK_TABLE}`
          ).test(s) &&
          s.includes(`${TASK_RATING_COL} DESC`) &&
          s.includes(`${TASK_STATUS_COL} ASC`)
      )
    ).toBe(true);
  });

  test('emits UNIQUE + WHERE clause when declared on the composite', async () => {
    const desired = computeDesiredPgLayout(
      createEntitySchemaRegistry()
        .register(
          defineEntitySchema({
            entityType: 'task',
            attributes: TaskAttr,
            composite: [
              {
                name: 'unique-rating-status',
                unique: true,
                fields: [{ tag: TaskAttr.rating }, { tag: TaskAttr.status }],
                where: [{ kind: 'attributeIsNotNull', tag: TaskAttr.status }],
              },
            ],
          })
        )
        .freeze()
    );
    const diff = diffPgLayout(desired, EMPTY_LIVE);
    const logger = createFakeLogger();
    const sqlClient = new RecordingSqlClient();
    await applyPgLayoutDiff(sqlClient, diff, logger);
    const expectedIndex = compositeIndexNameFor('task', 'unique-rating-status');
    expect(
      sqlClient.statements.some(
        (s) =>
          new RegExp(
            `CREATE UNIQUE INDEX IF NOT EXISTS ${expectedIndex} ON ${TASK_TABLE}`
          ).test(s) &&
          new RegExp(`WHERE ${TASK_STATUS_COL} IS NOT NULL`).test(s)
      )
    ).toBe(true);
  });
});
