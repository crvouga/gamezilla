import { createLogger } from '@pkgs/logger/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import type { IndexDialect } from './dialect';
import {
  PATCH_DB_INDEX_NAME_PREFIX,
  type NormalizedIndexSpec,
  type PatchDbIndexSpec,
} from './index-spec';
import { reconcileSnapshotIndexes } from './reconcile';

const silent = createLogger({ name: 'test', level: 'silent' });

/** Strips savepoint bookkeeping; {@link reconcileSnapshotIndexes} wraps each DDL in SAVEPOINT/RELEASE. */
function ddlOnly(ran: readonly string[]): string[] {
  return ran.filter(
    (s) =>
      !s.startsWith('SAVEPOINT ') &&
      !s.startsWith('RELEASE SAVEPOINT ') &&
      !s.startsWith('ROLLBACK TO SAVEPOINT ')
  );
}

class FakeSqlClient implements SqlClient {
  readonly ran: string[] = [];
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async query<T>(): Promise<T[]> {
    return [] as T[];
  }
  async run(
    sql: string
  ): Promise<{ changes: number; lastInsertRowid: number }> {
    this.ran.push(sql);
    return { changes: 0, lastInsertRowid: 0 };
  }
  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }
  prepare(): never {
    throw new Error('not implemented');
  }
}

function fakeDialect(existing: readonly string[]): IndexDialect {
  return {
    introspect: async () => existing,
    ddlCreate: (spec: NormalizedIndexSpec) => `CREATE_${spec.dbName}`,
    ddlDrop: (name: string) => `DROP_${name}`,
  };
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
  where: [{ kind: 'attributeAbsent', attribute: asKeyword('space/ended-at') }],
};

describe('reconcileSnapshotIndexes', () => {
  test('creates declared indexes that are missing from db', async () => {
    const sql = new FakeSqlClient();
    const result = await reconcileSnapshotIndexes({
      sqlClient: sql,
      logger: silent,
      dialect: fakeDialect([]),
      indexes: [SPEC_HOST, SPEC_LIVE],
    });
    expect(result.created.length).toBe(2);
    expect(result.dropped.length).toBe(0);
    expect(result.unchanged.length).toBe(0);
    const ddl = ddlOnly(sql.ran);
    expect(ddl.length).toBe(2);
    expect(ddl.every((s) => s.startsWith('CREATE_'))).toBe(true);
  });

  test('drops indexes in db that are not declared', async () => {
    const sql = new FakeSqlClient();
    const stranded = `${PATCH_DB_INDEX_NAME_PREFIX}old__zombie__deadbeef`;
    const result = await reconcileSnapshotIndexes({
      sqlClient: sql,
      logger: silent,
      dialect: fakeDialect([stranded]),
      indexes: [],
    });
    expect(result.dropped).toEqual([stranded]);
    expect(result.created.length).toBe(0);
    expect(ddlOnly(sql.ran)).toEqual([`DROP_${stranded}`]);
  });

  test('leaves declared indexes that already exist unchanged', async () => {
    const sql = new FakeSqlClient();
    // We compute the dbName by normalizing once via a helper dialect.
    const declared = [SPEC_HOST];
    // Run once with empty existing to learn the dbName the reconciler computes.
    const probeSql = new FakeSqlClient();
    const probe = await reconcileSnapshotIndexes({
      sqlClient: probeSql,
      logger: silent,
      dialect: fakeDialect([]),
      indexes: declared,
    });
    const dbName = probe.created[0]!;

    const result = await reconcileSnapshotIndexes({
      sqlClient: sql,
      logger: silent,
      dialect: fakeDialect([dbName]),
      indexes: declared,
    });
    expect(result.created).toEqual([]);
    expect(result.dropped).toEqual([]);
    expect(result.unchanged).toEqual([dbName]);
    expect(ddlOnly(sql.ran)).toEqual([]);
  });

  test('drift: spec content change rolls dbName -> drop old, create new', async () => {
    const sql = new FakeSqlClient();

    const oldSpec: PatchDbIndexSpec = {
      name: 'space-host',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
    };
    const newSpec: PatchDbIndexSpec = {
      ...oldSpec,
      fields: [
        { kind: 'attribute', attribute: asKeyword('space/host-id') },
        { kind: 'entityType' },
      ],
    };

    const probeSql = new FakeSqlClient();
    const probeOld = await reconcileSnapshotIndexes({
      sqlClient: probeSql,
      logger: silent,
      dialect: fakeDialect([]),
      indexes: [oldSpec],
    });
    const oldDbName = probeOld.created[0]!;

    const result = await reconcileSnapshotIndexes({
      sqlClient: sql,
      logger: silent,
      dialect: fakeDialect([oldDbName]),
      indexes: [newSpec],
    });
    expect(result.dropped).toEqual([oldDbName]);
    expect(result.created.length).toBe(1);
    expect(result.created[0]).not.toBe(oldDbName);
    // Drop happens before create so we never collide on a name.
    const ddl = ddlOnly(sql.ran);
    expect(ddl[0]!.startsWith('DROP_')).toBe(true);
    expect(ddl[1]!.startsWith('CREATE_')).toBe(true);
  });

  test('tolerates 42501 must be owner of relation errors', async () => {
    let calls = 0;
    const failingSql: SqlClient = {
      connect: async () => {},
      disconnect: async () => {},
      query: async () => [] as never[],
      run: async () => {
        calls++;
        const err = Object.assign(
          new Error('must be owner of relation snapshots'),
          { code: '42501' }
        );
        throw err;
      },
      transaction: async <T>(fn: (tx: SqlClient) => Promise<T>) =>
        fn(failingSql),
      prepare: (): never => {
        throw new Error('not implemented');
      },
    };
    const result = await reconcileSnapshotIndexes({
      sqlClient: failingSql,
      logger: silent,
      dialect: fakeDialect([]),
      indexes: [SPEC_HOST],
    });
    expect(calls).toBeGreaterThan(0);
    expect(result.created.length).toBe(1);
  });
});
