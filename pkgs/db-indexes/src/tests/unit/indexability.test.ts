import { describe, expect, test } from 'bun:test';
import type { WorkloadManifest } from '../../core/types';
import {
  analyzeIndexability,
  assertIndexableWorkload,
  fingerprintSql,
  parseWithNodeSqlParser,
  pkSchemaIndexes,
} from '../../index';

function stmt(sql: string, index = 0) {
  return {
    index,
    sql,
    fingerprint: fingerprintSql(sql),
    weight: 1,
  };
}

function manifest(
  name: string,
  sql: string,
  hydrates: readonly string[] = ['notes']
): WorkloadManifest {
  return {
    version: 1,
    queries: [{ name, hydrates: [...hydrates], statements: [stmt(sql)] }],
  };
}

describe('parseWithNodeSqlParser subqueries', () => {
  test('IN subquery emits paths for outer and inner tables', () => {
    const sql = `
      SELECT id FROM spaces
      WHERE host_member_id = ?
         OR id IN (SELECT space_id FROM spaces_users WHERE user_id = ?)
    `;
    const parsed = parseWithNodeSqlParser(sql, 'PostgreSQL');
    expect(parsed.ok).toBe(true);
    expect(parsed.tables).toContain('spaces');
    expect(parsed.tables).toContain('spaces_users');
    const tables = new Set(parsed.paths.map((p) => p.table));
    expect(tables.has('spaces')).toBe(true);
    expect(tables.has('spaces_users')).toBe(true);
    const usersPath = parsed.paths.find(
      (p) => p.table === 'spaces_users' && p.equality.includes('user_id')
    );
    expect(usersPath).toBeDefined();
  });

  test('nested actor-visible spaces shape yields friend + membership paths', () => {
    const sql = `
      SELECT id FROM spaces
      WHERE host_member_id = ?
         OR host_account_id = ?
         OR id IN (SELECT space_id FROM spaces_users WHERE user_id = ?)
         OR host_account_id IN (
           SELECT CASE WHEN f.user_low = ? THEN f.user_high ELSE f.user_low END AS friend_id
           FROM friends_friendships AS f
           WHERE f.user_low = ? OR f.user_high = ?
         )
    `;
    const parsed = parseWithNodeSqlParser(sql, 'PostgreSQL');
    expect(parsed.ok).toBe(true);
    expect(parsed.tables).toContain('friends_friendships');
    expect(parsed.paths.some((p) => p.table === 'friends_friendships')).toBe(
      true
    );
    expect(
      parsed.paths.some(
        (p) => p.table === 'spaces_users' && p.equality.includes('user_id')
      )
    ).toBe(true);
  });
});

describe('analyzeIndexability', () => {
  test('equality filter is indexable via autoidx candidate', () => {
    const report = analyzeIndexability({
      manifest: manifest('q', 'SELECT id FROM notes WHERE user_id = ?'),
      schemaIndexes: pkSchemaIndexes(['notes']),
      catalogTables: new Set(),
    });
    expect(report.gaps).toEqual([]);
  });

  test('pk-only is covered', () => {
    const report = analyzeIndexability({
      manifest: manifest('q', 'SELECT id FROM notes WHERE id = ?', ['notes']),
      schemaIndexes: pkSchemaIndexes(['notes']),
      catalogTables: new Set(),
    });
    expect(report.gaps).toEqual([]);
  });

  test('empty select on non-catalog gaps', () => {
    const report = analyzeIndexability({
      manifest: manifest('q', 'SELECT id FROM spaces', ['spaces']),
      schemaIndexes: pkSchemaIndexes(['spaces']),
      catalogTables: new Set(),
    });
    expect(report.gaps.length).toBeGreaterThan(0);
    expect(report.gaps[0]!.reason).toBe('empty_key');
  });

  test('catalog allowlist permits unfiltered snapshot', () => {
    const report = analyzeIndexability({
      manifest: manifest(
        'clientConfig',
        'SELECT id, value FROM client_config',
        ['client_config']
      ),
      schemaIndexes: pkSchemaIndexes(['client_config']),
      catalogTables: new Set(['client_config']),
    });
    expect(report.gaps).toEqual([]);
  });

  test('schema leftmost unique covers blocker_id', () => {
    const report = analyzeIndexability({
      manifest: manifest(
        'blocks',
        'SELECT id FROM friends_blocks WHERE blocker_id = ?',
        ['friends_blocks']
      ),
      schemaIndexes: [
        ...pkSchemaIndexes(['friends_blocks']),
        { table: 'friends_blocks', columns: ['blocker_id', 'blocked_id'] },
      ],
      catalogTables: new Set(),
    });
    expect(report.gaps).toEqual([]);
  });

  test('assertIndexableWorkload throws deterministic message', () => {
    const args = {
      manifest: manifest('bad', 'SELECT id FROM spaces', ['spaces']),
      schemaIndexes: pkSchemaIndexes(['spaces']),
      catalogTables: new Set<string>(),
    };
    let a = '';
    let b = '';
    try {
      assertIndexableWorkload(args);
    } catch (e) {
      a = e instanceof Error ? e.message : String(e);
    }
    try {
      assertIndexableWorkload(args);
    } catch (e) {
      b = e instanceof Error ? e.message : String(e);
    }
    expect(a.length).toBeGreaterThan(0);
    expect(a).toBe(b);
    expect(a).toContain('UNINDEXABLE');
    expect(a).toContain('bad');
  });
});
