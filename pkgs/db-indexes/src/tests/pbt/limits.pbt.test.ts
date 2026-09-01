import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '../../core/fingerprint';
import { ingestManifest } from '../../core/ingest';
import { LIMITS, LimitExceededError } from '../../core/limits';

describe('limits PBT', () => {
  test('over-limit statements throws LimitExceededError with zero partial', () => {
    const stmts = Array.from({ length: LIMITS.maxStatements + 1 }, (_, i) => {
      const sql = `SELECT id FROM t WHERE c = ? /*${String(i)}*/`;
      return {
        index: 0,
        sql,
        fingerprint: fingerprintSql(sql),
        weight: 1,
      };
    });
    const queries = stmts.map((s, i) => ({
      name: `q${String(i)}`,
      hydrates: ['t'] as const,
      statements: [s],
    }));
    let threw: unknown;
    try {
      ingestManifest({ version: 1, queries });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(LimitExceededError);
  });

  test('at-limit succeeds', () => {
    const n = Math.min(32, LIMITS.maxStatements);
    const queries = Array.from({ length: n }, (_, i) => {
      const sql = `SELECT id FROM t WHERE c${String(i % 8)} = ?`;
      return {
        name: `q${String(i)}`,
        hydrates: ['t'] as const,
        statements: [
          {
            index: 0,
            sql,
            fingerprint: fingerprintSql(sql),
            weight: 1,
          },
        ],
      };
    });
    const ingested = ingestManifest({ version: 1, queries });
    expect(ingested.statements.length).toBe(n);
  });
});
