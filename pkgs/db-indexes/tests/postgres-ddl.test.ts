import { describe, expect, test } from 'bun:test';
import { asOwnedIndexName } from '../src/core/types';
import {
  isConcurrentlyUnsupportedError,
  renderCreateIndexSql,
  renderDropIndexSql,
} from '../src/postgres/render-ddl';

const def = {
  table: 'notes',
  columns: [{ name: 'user_id', order: 'asc' as const }],
  include: [] as string[],
  predicate: null as string | null,
};

const name = asOwnedIndexName('autoidx_notes_abcd1234');

describe('postgres render-ddl', () => {
  test('create with CONCURRENTLY by default', () => {
    const sql = renderCreateIndexSql(def, name);
    expect(sql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS');
    expect(sql).toContain(`"${name}"`);
    expect(sql).toContain('ON "notes"');
  });

  test('create without CONCURRENTLY when concurrently=false', () => {
    const sql = renderCreateIndexSql(def, name, false);
    expect(sql).toBe(
      `CREATE INDEX IF NOT EXISTS "${name}" ON "notes" ("user_id" ASC)`
    );
    expect(sql).not.toContain('CONCURRENTLY');
  });

  test('drop with and without CONCURRENTLY', () => {
    expect(renderDropIndexSql(name, true)).toContain('DROP INDEX CONCURRENTLY');
    expect(renderDropIndexSql(name, false)).toBe(
      `DROP INDEX IF EXISTS "${name}"`
    );
  });

  test('isConcurrentlyUnsupportedError matches Postgres messages', () => {
    expect(
      isConcurrentlyUnsupportedError(
        new Error(
          'CREATE INDEX CONCURRENTLY cannot run inside a transaction block'
        )
      )
    ).toBe(true);
    expect(
      isConcurrentlyUnsupportedError(new Error('relation already exists'))
    ).toBe(false);
  });
});
