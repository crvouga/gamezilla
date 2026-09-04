import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import type { WorkloadManifest } from '../../core/types';
import {
  analyzeIndexability,
  assertIndexableWorkload,
  fingerprintSql,
  pkSchemaIndexes,
} from '../../index';

function stmt(sql: string) {
  return {
    index: 0,
    sql,
    fingerprint: fingerprintSql(sql),
    weight: 1,
  };
}

function single(
  name: string,
  sql: string,
  hydrates: readonly string[]
): WorkloadManifest {
  return {
    version: 1,
    queries: [{ name, hydrates: [...hydrates], statements: [stmt(sql)] }],
  };
}

describe('indexability PBT', () => {
  test('WHERE col = ? is always gap-free', () => {
    assertProperty(
      'equality indexable',
      fc.property(
        fc.constantFrom('notes', 'users', 'spaces', 'friends_requests'),
        fc.constantFrom('user_id', 'owner_id', 'from_user_id', 'host_id'),
        (table, col) => {
          const report = analyzeIndexability({
            manifest: single(
              `q_${table}`,
              `SELECT id FROM ${table} WHERE ${col} = ?`,
              [table]
            ),
            schemaIndexes: pkSchemaIndexes([table]),
            catalogTables: new Set(),
          });
          expect(report.gaps).toEqual([]);
        }
      ),
      { numRuns: 40 }
    );
  });

  test('unfiltered SELECT on non-catalog always gaps', () => {
    assertProperty(
      'empty key gap',
      fc.property(
        fc.constantFrom('spaces', 'notes', 'friends_requests'),
        (table) => {
          const report = analyzeIndexability({
            manifest: single('dump', `SELECT id FROM ${table}`, [table]),
            schemaIndexes: pkSchemaIndexes([table]),
            catalogTables: new Set(),
          });
          expect(report.gaps.length).toBeGreaterThan(0);
          expect(report.gaps[0]!.reason).toBe('empty_key');
        }
      ),
      { numRuns: 20 }
    );
  });

  test('unique leftmost prefix covers without candidate', () => {
    const report = analyzeIndexability({
      manifest: single(
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

  test('assertIndexableWorkload throw text is deterministic', () => {
    assertProperty(
      'throw stable',
      fc.property(fc.constantFrom('spaces', 'notes'), (table) => {
        const args = {
          manifest: single('bad', `SELECT id FROM ${table}`, [table]),
          schemaIndexes: pkSchemaIndexes([table]),
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
      }),
      { numRuns: 20 }
    );
  });
});
