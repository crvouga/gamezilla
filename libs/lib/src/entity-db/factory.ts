import { assert } from '../assert';
import type { SqlClient } from '../sql-client/interface';
import { EntityDbImplInMemory } from './impl-in-memory';
import { EntityDbImplPostgres } from './impl-postgres';
import type {
  CompareVersions,
  Entity,
  EntityDb,
  EntityKey,
  UpsertArgs,
} from './interface';
import {
  assertCompareVersionsResult,
  assertEntityKey,
  assertUpsertArgs,
} from './interface';
import { DEFAULT_POSTGRES_ENTITY_TABLE } from './constants';
import { assertSafeIdentifier } from './identifier';

type CreateEntityDbConfig = {
  sqlClient: SqlClient;
  /** Defaults to {@link DEFAULT_POSTGRES_ENTITY_TABLE}. */
  tableName?: string;
  schema?: string;
  compareVersions: CompareVersions;
};

function wrapCompareVersions(
  compareVersions: CompareVersions
): CompareVersions {
  assert.ok(
    typeof compareVersions === 'function',
    'entity-db: compareVersions must be a function'
  );
  return assert.fn(
    {
      fn: compareVersions,
      pre: (incoming: unknown, existing: unknown) => {
        assert.ok(
          incoming !== undefined,
          'entity-db: compareVersions incoming must not be undefined'
        );
        assert.ok(
          existing !== undefined,
          'entity-db: compareVersions existing must not be undefined'
        );
      },
      post: (cmp: number) => {
        assertCompareVersionsResult(cmp);
      },
    },
    'entity-db: compareVersions',
    {}
  ) as CompareVersions;
}

/**
 * Postgres-backed {@link EntityDb}. Requires a {@link SqlClient} whose
 * {@link SqlClient#transaction} maps to a real DB transaction when correctness
 * depends on `SELECT ... FOR UPDATE` (e.g. Bun TCP Postgres, not necessarily HTTP SQL).
 */
export function createEntityDb(config: CreateEntityDbConfig): EntityDb {
  assert.defined(config.sqlClient, 'entity-db: sqlClient is required');
  const tableName = config.tableName ?? DEFAULT_POSTGRES_ENTITY_TABLE;
  assertSafeIdentifier(tableName, 'tableName');
  if (config.schema !== undefined && config.schema.length > 0) {
    assertSafeIdentifier(config.schema, 'schema');
  }
  const wrapped = wrapCompareVersions(config.compareVersions);
  const inner = new EntityDbImplPostgres(
    config.sqlClient,
    tableName,
    config.schema,
    wrapped
  );
  return new EntityDbAsserts(inner);
}

/** In-memory store for tests (same API + assert surface as {@link createEntityDb}). */
export function createEntityDbInMemory(
  compareVersions: CompareVersions
): EntityDb {
  const wrapped = wrapCompareVersions(compareVersions);
  return new EntityDbAsserts(new EntityDbImplInMemory(wrapped));
}

/** Tiger Style: re-validate all inputs at the public boundary before delegating. */
class EntityDbAsserts implements EntityDb {
  constructor(private readonly inner: EntityDb) {}

  upsert(args: UpsertArgs): Promise<{ applied: boolean }> {
    assertUpsertArgs(args);
    return this.inner.upsert(args);
  }

  get(key: EntityKey): Promise<Entity | null> {
    assertEntityKey(key);
    return this.inner.get(key);
  }

  delete(key: EntityKey): Promise<void> {
    assertEntityKey(key);
    return this.inner.delete(key);
  }
}
