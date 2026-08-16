/**
 * In-memory {@link SqlClient} backed by AlaSQL named databases.
 *
 * Intended for browser Console / multi-actor playground sims where Expo OPFS
 * SQLite is unsuitable. Shims SQLite PRAGMA / sqlite_master and strips
 * dialect AlaSQL rejects (`STRICT`, `INDEX IF NOT EXISTS`, `RETURNING`,
 * parameterized `LIMIT` / `OFFSET`).
 */

import { assert } from '@pkgs/assert';
import type { Sql, Value } from '@pkgs/sql';
import alasql from 'alasql';
import type { PreparedStatement, RunResult, SqlClient } from '../interface';
import {
  adaptSqliteDialect,
  inlineLimitOffsetParams,
  isPragmaSql,
  isSqliteMasterSql,
  parseCreateIndex,
  parseDropIndex,
  parseDropTable,
  parsePragmaBody,
  unquoteIdent,
} from './impl-alasql-adapt';
import {
  buildInsertReturningSteps,
  type InsertReturningPlan,
  planInsertReturning,
} from './impl-alasql-insert-returning';
import {
  buildUpsertExecSteps,
  type OnConflictUpsertPlan,
  planOnConflictUpsert,
} from './impl-alasql-on-conflict';
import {
  buildUpdateReturningPostSelect,
  buildUpdateReturningSteps,
  planUpdateReturning,
  type UpdateReturningPlan,
} from './impl-alasql-update-returning';

type AlaSqlTable = {
  columns: readonly {
    columnid: string;
    dbtypeid?: string;
    notnull?: boolean;
  }[];
};

type AlaSqlDatabase = {
  tables: Record<string, AlaSqlTable>;
  exec: (sql: string, params?: Value[]) => unknown;
};

type IndexMeta = {
  readonly table: string;
  readonly columns: readonly string[];
  readonly unique: boolean;
};

function snapshotTables(
  tables: Record<string, unknown>
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(tables)) as Record<string, unknown>;
}

function sqlVerb(sqlText: string): string {
  return (
    sqlText
      .replace(/^\s*\(/, '')
      .trimStart()
      .split(/\s+/, 1)[0] ?? ''
  );
}

function isInsert(sqlText: string): boolean {
  return sqlVerb(sqlText).toUpperCase() === 'INSERT';
}

function isDdl(sqlText: string): boolean {
  const verb = sqlVerb(sqlText).toUpperCase();
  return (
    verb === 'CREATE' ||
    verb === 'DROP' ||
    verb === 'ALTER' ||
    verb === 'TRUNCATE'
  );
}

function toRows<T extends Record<string, unknown>>(result: unknown): T[] {
  if (result == null) return [];
  if (Array.isArray(result)) return result as T[];
  return [];
}

function rawChanges(result: unknown): number {
  if (typeof result === 'number') return result;
  if (Array.isArray(result)) return result.length;
  return 0;
}

function toRunResult(
  result: unknown,
  sqlText: string,
  lastInsertRowid: number
): RunResult {
  if (isDdl(sqlText)) {
    return { changes: 0, lastInsertRowid: 0 };
  }
  const changes = rawChanges(result);
  return {
    changes,
    lastInsertRowid: isInsert(sqlText) && changes > 0 ? lastInsertRowid : 0,
  };
}

export class SqlClientImplAlaSql implements SqlClient {
  private db: AlaSqlDatabase | null;
  private readonly databaseName: string;
  private lastInsertRowid = 0;
  private txDepth = 0;
  private userVersion = 0;
  private readonly indexes = new Map<string, IndexMeta>();

  private constructor(databaseName: string, db: AlaSqlDatabase) {
    this.databaseName = databaseName;
    this.db = db;
  }

  static open(databaseName: string): SqlClientImplAlaSql {
    assert.ok(
      databaseName.length > 0,
      'SqlClientImplAlaSql.open requires a non-empty database name'
    );
    const db = new alasql.Database(databaseName) as AlaSqlDatabase;
    return new SqlClientImplAlaSql(databaseName, db);
  }

  private requireDb(): AlaSqlDatabase {
    assert.ok(this.db != null, 'SqlClientImplAlaSql: database is closed', {
      databaseName: this.databaseName,
    });
    return this.db;
  }

  private execPragma(body: string): unknown {
    const assign = /^user_version\s*=\s*(-?\d+)\s*$/i.exec(body);
    if (assign != null) {
      this.userVersion = Number(assign[1]);
      return [];
    }
    if (/^user_version\s*$/i.test(body)) {
      return [{ user_version: this.userVersion }];
    }

    const tableInfo = /^table_info\s*\(\s*([^)]+?)\s*\)\s*$/i.exec(body);
    if (tableInfo != null) {
      return this.pragmaTableInfo(unquoteIdent(tableInfo[1]!));
    }

    const indexList = /^index_list\s*\(\s*([^)]+?)\s*\)\s*$/i.exec(body);
    if (indexList != null) {
      return this.pragmaIndexList(unquoteIdent(indexList[1]!));
    }

    const indexInfo = /^index_info\s*\(\s*([^)]+?)\s*\)\s*$/i.exec(body);
    if (indexInfo != null) {
      return this.pragmaIndexInfo(unquoteIdent(indexInfo[1]!));
    }

    // Connection / journal PRAGMAs — no-ops for in-memory AlaSQL.
    return [];
  }

  private pragmaTableInfo(table: string): unknown {
    const db = this.requireDb();
    const tbl = db.tables[table];
    if (tbl == null) return [];
    return tbl.columns.map((col, i) => {
      const isId = col.columnid === 'id';
      const notnull = col.notnull === true || isId ? 1 : 0;
      return {
        cid: i,
        name: col.columnid,
        type: (col.dbtypeid ?? 'TEXT').toUpperCase(),
        notnull,
        dflt_value: null,
        pk: isId ? 1 : 0,
      };
    });
  }

  private pragmaIndexList(table: string): unknown {
    const rows: { name: string; origin: string; unique: number }[] = [];
    for (const [name, meta] of this.indexes) {
      if (meta.table !== table) continue;
      rows.push({
        name,
        origin: 'c',
        unique: meta.unique ? 1 : 0,
      });
    }
    return rows;
  }

  private pragmaIndexInfo(indexName: string): unknown {
    const meta = this.indexes.get(indexName);
    if (meta == null) return [];
    return meta.columns.map((name, seqno) => ({
      seqno,
      cid: seqno,
      name,
    }));
  }

  private querySqliteMaster(sqlText: string): unknown {
    const wantsIndexes = /\btype\s*=\s*'index'/i.test(sqlText);
    const db = this.requireDb();
    if (wantsIndexes) {
      return [...this.indexes.keys()].sort().map((name) => ({ name }));
    }
    return Object.keys(db.tables)
      .filter((name) => !name.startsWith('sqlite_'))
      .sort()
      .map((name) => ({ name }));
  }

  private noteIndexDdl(sqlText: string): void {
    const created = parseCreateIndex(sqlText);
    if (created != null) {
      this.indexes.set(created.name, {
        table: created.table,
        columns: created.columns,
        unique: created.unique,
      });
      return;
    }
    const dropped = parseDropIndex(sqlText);
    if (dropped != null) {
      this.indexes.delete(dropped);
      return;
    }
    const droppedTable = parseDropTable(sqlText);
    if (droppedTable != null) {
      for (const [name, meta] of this.indexes) {
        if (meta.table === droppedTable) this.indexes.delete(name);
      }
    }
  }

  private execAla(
    sqlText: string,
    params?: readonly Value[] | unknown[]
  ): unknown {
    const db = this.requireDb();
    const bound = inlineLimitOffsetParams(sqlText, params);
    if (bound.params.length === 0) {
      return db.exec(bound.sql);
    }
    return db.exec(bound.sql, bound.params as Value[]);
  }

  private execUpsert(
    plan: OnConflictUpsertPlan,
    params?: readonly Value[]
  ): unknown {
    const steps = buildUpsertExecSteps(plan, params);
    const existing = toRows<{ present: number }>(
      this.execAla(steps.existsSelectSql, steps.existsParams)
    );
    const exists = existing.length > 0;

    if (exists) {
      if (plan.mode === 'update' && steps.updateSql != null) {
        this.execAla(steps.updateSql, steps.updateParams);
      }
      // DO NOTHING: leave row as-is
    } else {
      this.execAla(steps.insertSql, steps.insertParams as Value[]);
    }

    if (steps.returningSelectSql != null) {
      return this.execAla(steps.returningSelectSql, steps.returningParams);
    }
    return [];
  }

  private execUpserts(
    plans: readonly OnConflictUpsertPlan[],
    params?: readonly Value[]
  ): unknown {
    const returned: Record<string, unknown>[] = [];
    let hasReturning = false;
    for (const plan of plans) {
      const result = this.execUpsert(plan, params);
      if (plan.returning != null) {
        hasReturning = true;
        returned.push(...toRows(result));
      }
    }
    return hasReturning ? returned : [];
  }

  private execInsertReturning(
    plan: InsertReturningPlan,
    params?: readonly Value[]
  ): unknown {
    const steps = buildInsertReturningSteps(plan, params);
    this.execAla(steps.insertSql, steps.insertParams as Value[]);
    this.lastInsertRowid += 1;
    return this.execAla(steps.selectSql, steps.selectParams as Value[]);
  }

  private execUpdateReturning(
    plan: UpdateReturningPlan,
    params?: readonly Value[]
  ): unknown {
    const steps = buildUpdateReturningSteps(plan, params);
    const idRows = toRows<{ id: unknown }>(
      this.execAla(
        adaptSqliteDialect(steps.preSelectSql),
        steps.preSelectParams as Value[]
      )
    );
    this.execAla(
      adaptSqliteDialect(steps.updateSql),
      steps.updateParams as Value[]
    );
    const ids = idRows.map((r) => r.id).filter((id) => id != null && id !== '');
    const post = buildUpdateReturningPostSelect(steps, ids);
    if (post === null) return [];
    return this.execAla(adaptSqliteDialect(post.sql), post.params as Value[]);
  }

  private execAdapted(
    sqlText: string,
    adapted: string,
    params?: readonly Value[]
  ): unknown {
    const upserts = planOnConflictUpsert(adapted);
    if (upserts != null) return this.execUpserts(upserts, params);

    const createIx = parseCreateIndex(adapted);
    if (createIx != null && this.indexes.has(createIx.name)) return [];

    const dropIx = parseDropIndex(adapted);
    if (
      dropIx != null &&
      /^\s*DROP\s+INDEX\s+IF\s+NOT\s+EXISTS\b/i.test(sqlText) &&
      !this.indexes.has(dropIx)
    ) {
      return [];
    }

    const bound = inlineLimitOffsetParams(adapted, params);
    const db = this.requireDb();
    const result =
      bound.params.length === 0
        ? db.exec(bound.sql)
        : db.exec(bound.sql, bound.params as Value[]);
    this.noteIndexDdl(adapted);
    return result;
  }

  private execRaw(sqlText: string, params?: readonly Value[]): unknown {
    if (isSqliteMasterSql(sqlText)) {
      return this.querySqliteMaster(sqlText);
    }
    if (isPragmaSql(sqlText)) {
      const body = parsePragmaBody(sqlText);
      assert.ok(body != null, 'SqlClientImplAlaSql: invalid PRAGMA', {
        sqlText,
      });
      return this.execPragma(body);
    }

    const insertRet = planInsertReturning(sqlText);
    if (insertRet != null) {
      return this.execInsertReturning(insertRet, params);
    }

    const updateRet = planUpdateReturning(sqlText);
    if (updateRet != null) {
      return this.execUpdateReturning(updateRet, params);
    }

    return this.execAdapted(sqlText, adaptSqliteDialect(sqlText), params);
  }

  private noteInsert(sqlText: string, result: unknown): void {
    if (isInsert(sqlText) && rawChanges(result) > 0) {
      this.lastInsertRowid += 1;
    }
  }

  private runSql(sqlText: string, params?: readonly Value[]): RunResult {
    const adapted = isPragmaSql(sqlText)
      ? sqlText
      : adaptSqliteDialect(sqlText);
    const result = this.execRaw(sqlText, params);
    this.noteInsert(adapted, result);
    return toRunResult(result, adapted, this.lastInsertRowid);
  }

  async connect(): Promise<void> {
    try {
      this.execRaw('SELECT 1');
    } catch (err) {
      assert.ok(false, 'Database connection failed', { error: err });
    }
  }

  async disconnect(): Promise<void> {
    if (this.db == null) return;
    try {
      alasql(`DROP DATABASE IF EXISTS ${this.databaseName}`);
    } catch (err) {
      assert.ok(false, 'Database disconnection failed', { error: err });
    } finally {
      this.db = null;
      this.indexes.clear();
      this.userVersion = 0;
    }
  }

  /**
   * JSON dump for playground ObjectStore snapshots (not SQLite binary).
   */
  exportDatabaseBytes(): Uint8Array {
    const db = this.requireDb();
    const payload = {
      v: 1 as const,
      kind: 'alasql' as const,
      userVersion: this.userVersion,
      indexes: [...this.indexes.entries()],
      tables: snapshotTables(db.tables as Record<string, unknown>),
    };
    return new TextEncoder().encode(JSON.stringify(payload));
  }

  /**
   * Restore a prior {@link exportDatabaseBytes} payload into this connection.
   */
  importDatabaseBytes(bytes: Uint8Array): void {
    const text = new TextDecoder().decode(bytes);
    let payload: {
      v: number;
      kind?: string;
      userVersion: number;
      indexes: readonly [string, IndexMeta][];
      tables: Record<string, unknown>;
    };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      throw new Error(
        'SqlClientImplAlaSql.importDatabaseBytes: expected JSON alasql snapshot'
      );
    }
    if (payload.v !== 1 || payload.kind !== 'alasql') {
      throw new Error(
        'SqlClientImplAlaSql.importDatabaseBytes: unsupported snapshot format'
      );
    }
    const db = this.requireDb();
    db.tables = snapshotTables(payload.tables) as AlaSqlDatabase['tables'];
    this.indexes.clear();
    for (const [k, v] of payload.indexes) {
      this.indexes.set(k, v);
    }
    this.userVersion = payload.userVersion;
  }

  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const result = this.execRaw(query.sql, query.values);
    return Promise.resolve(toRows<T>(result));
  }

  run(query: Sql<unknown>): Promise<RunResult> {
    return Promise.resolve(this.runSql(query.sql, query.values));
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const sqlText = query.sql;
    return {
      query: (params?: Value[]) => {
        const result = this.execRaw(sqlText, params);
        return Promise.resolve(toRows<T>(result));
      },
      run: (params?: Value[]) => {
        return Promise.resolve(this.runSql(sqlText, params));
      },
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    if (this.txDepth > 0) {
      return fn(this);
    }
    const db = this.requireDb();
    const snapshot = snapshotTables(db.tables as Record<string, unknown>);
    const indexSnapshot = new Map(this.indexes);
    const versionSnapshot = this.userVersion;
    this.txDepth += 1;
    try {
      return await fn(this);
    } catch (e) {
      db.tables = snapshotTables(snapshot) as AlaSqlDatabase['tables'];
      this.indexes.clear();
      for (const [k, v] of indexSnapshot) this.indexes.set(k, v);
      this.userVersion = versionSnapshot;
      throw e;
    } finally {
      this.txDepth -= 1;
    }
  }
}
