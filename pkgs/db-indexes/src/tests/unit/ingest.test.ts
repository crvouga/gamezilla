import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '../../core/fingerprint';
import { ingestManifest } from '../../core/ingest';
import { LIMITS } from '../../core/limits';
import type { WorkloadManifest } from '../../core/types';

function stmt(sql: string, index = 0) {
  return {
    index,
    sql,
    fingerprint: fingerprintSql(sql),
    weight: 1,
  };
}

describe('ingest', () => {
  test('accepts valid manifest', () => {
    const manifest: WorkloadManifest = {
      version: 1,
      queries: [
        {
          name: 'ownUser',
          hydrates: ['auth_users'],
          statements: [stmt('SELECT id FROM auth_users WHERE id = ?')],
        },
      ],
    };
    const result = ingestManifest(manifest);
    expect(result.statements.length).toBe(1);
    expect(result.skipped.length).toBe(0);
  });

  test('zero-statement query → skipped', () => {
    const manifest: WorkloadManifest = {
      version: 1,
      queries: [{ name: 'empty', hydrates: [], statements: [] }],
    };
    const result = ingestManifest(manifest);
    expect(result.skipped.some((s) => s.reason === 'zero_statements')).toBe(
      true
    );
  });

  test('bad fingerprint is skipped, not thrown', () => {
    const sql = 'SELECT id FROM notes WHERE user_id = ?';
    const result = ingestManifest({
      version: 1,
      queries: [
        {
          name: 'bad',
          hydrates: ['notes'],
          statements: [
            { index: 0, sql, fingerprint: 'deadbeef', weight: 1 },
            { index: 1, sql, fingerprint: '0'.repeat(64), weight: 1 },
          ],
        },
      ],
    });
    expect(result.statements.length).toBe(0);
    expect(
      result.skipped.every((s) => s.reason === 'fingerprint_divergence')
    ).toBe(true);
    expect(result.skipped.length).toBe(2);
  });

  test('exceeding maxStatements throws at boundary', () => {
    const queries: WorkloadManifest['queries'][number][] = [];
    for (let i = 0; i < LIMITS.maxStatements + 1; i++) {
      queries.push({
        name: `q${String(i)}`,
        hydrates: [],
        statements: [stmt(`SELECT ${String(i)} AS n FROM t`, 0)],
      });
    }
    expect(() => ingestManifest({ version: 1, queries })).toThrow(
      /exceeds limit/
    );
  });
});
