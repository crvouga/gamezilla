import { createLogger } from '@gamezilla/lib/logger';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@gamezilla/lib/keyword';
import {
  normalizeIndexSpec,
  PATCH_DB_INDEX_NAME_PREFIX,
  type PatchDbIndexSpec,
} from '../indexes/index-spec';
import { reconcileSnapshotIndexes } from '../indexes/reconcile';
import {
  sqliteDdlCreate,
  sqliteDdlDrop,
  sqliteIndexDialect,
} from './index-dialect-sqlite';
import { migratePatchDbSqlite } from './migrate';

describe('sqliteDdlCreate', () => {
  test('attribute column uses json_extract with quoted JSON path', () => {
    const spec = normalizeIndexSpec({
      name: 'space-host',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
    });
    const ddl = sqliteDdlCreate(spec);
    expect(ddl).toContain(`json_extract(attributes, '$."space/host-id"')`);
    expect(ddl).toContain(`WHERE entity_type = 'space'`);
  });

  test('partial WHERE attributeAbsent compiles to IS NULL', () => {
    const spec = normalizeIndexSpec({
      name: 'space-live',
      entityType: 'space',
      fields: [{ kind: 'entityType' }, { kind: 'entityId' }],
      where: [
        { kind: 'attributeAbsent', attribute: asKeyword('space/ended-at') },
      ],
    });
    const ddl = sqliteDdlCreate(spec);
    expect(ddl).toContain(`(entity_type, entity_id)`);
    expect(ddl).toContain(
      `AND json_extract(attributes, '$."space/ended-at"') IS NULL`
    );
  });

  test('attributeExists compiles to IS NOT NULL', () => {
    const spec = normalizeIndexSpec({
      name: 'mship-mat',
      entityType: 'space.membership',
      fields: [{ kind: 'entityId' }],
      where: [
        {
          kind: 'attributeExists',
          attribute: asKeyword('space.membership/guest-id'),
        },
      ],
    });
    const ddl = sqliteDdlCreate(spec);
    expect(ddl).toContain(
      `AND json_extract(attributes, '$."space.membership/guest-id"') IS NOT NULL`
    );
  });
});

describe('sqliteDdlDrop', () => {
  test('idempotent DROP INDEX IF EXISTS', () => {
    expect(sqliteDdlDrop('pdb_idx_x__y__abc12345')).toBe(
      `DROP INDEX IF EXISTS "pdb_idx_x__y__abc12345"`
    );
  });
});

describe('sqlite index reconciliation (in-memory bun:sqlite)', () => {
  const log = createLogger({ name: 'test', level: 'silent' });

  async function makeDb() {
    const db = new Database(':memory:');
    const sql = new SqlClientImplBunSqlite(db);
    return { db, sql };
  }

  const SPEC_HOST: PatchDbIndexSpec = {
    name: 'space-host',
    entityType: 'space',
    fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
  };

  const SPEC_LIVE: PatchDbIndexSpec = {
    name: 'space-live',
    entityType: 'space',
    fields: [{ kind: 'entityType' }, { kind: 'entityId' }],
    where: [
      { kind: 'attributeAbsent', attribute: asKeyword('space/ended-at') },
    ],
  };

  test('migrate -> reconcile creates declared indexes; second pass is no-op', async () => {
    const { sql } = await makeDb();
    await migratePatchDbSqlite(sql, {
      logger: log,
      indexes: [SPEC_HOST, SPEC_LIVE],
    });
    const present1 = await sql.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='snapshots' AND name LIKE ? ORDER BY name`,
      [`${PATCH_DB_INDEX_NAME_PREFIX}%`]
    );
    expect(present1.length).toBe(2);

    const result = await reconcileSnapshotIndexes({
      sqlClient: sql,
      logger: log,
      dialect: sqliteIndexDialect,
      indexes: [SPEC_HOST, SPEC_LIVE],
    });
    expect(result.created.length).toBe(0);
    expect(result.dropped.length).toBe(0);
    expect(result.unchanged.length).toBe(2);
  });

  test('removing a spec drops the orphan on next reconcile', async () => {
    const { sql } = await makeDb();
    await migratePatchDbSqlite(sql, {
      logger: log,
      indexes: [SPEC_HOST, SPEC_LIVE],
    });
    const result = await reconcileSnapshotIndexes({
      sqlClient: sql,
      logger: log,
      dialect: sqliteIndexDialect,
      indexes: [SPEC_HOST],
    });
    expect(result.dropped.length).toBe(1);
    expect(result.unchanged).toEqual([normalizeIndexSpec(SPEC_HOST).dbName]);
    const remaining = await sql.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='snapshots' AND name LIKE ?`,
      [`${PATCH_DB_INDEX_NAME_PREFIX}%`]
    );
    expect(remaining.map((r) => r.name)).toEqual([
      normalizeIndexSpec(SPEC_HOST).dbName,
    ]);
  });

  test('changing a spec content rolls dbName: drops old, creates new', async () => {
    const { sql } = await makeDb();
    await migratePatchDbSqlite(sql, { logger: log, indexes: [SPEC_HOST] });
    const oldDbName = normalizeIndexSpec(SPEC_HOST).dbName;

    const evolved: PatchDbIndexSpec = {
      ...SPEC_HOST,
      fields: [
        { kind: 'attribute', attribute: asKeyword('space/host-id') },
        { kind: 'entityType' },
      ],
    };
    const result = await reconcileSnapshotIndexes({
      sqlClient: sql,
      logger: log,
      dialect: sqliteIndexDialect,
      indexes: [evolved],
    });
    expect(result.dropped).toEqual([oldDbName]);
    expect(result.created.length).toBe(1);
    expect(result.created[0]).not.toBe(oldDbName);
  });
});
