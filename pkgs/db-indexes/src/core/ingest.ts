import { assert } from '@pkgs/assert';
import { fingerprintSql, normalizeSql } from './fingerprint';
import { assertWithinLimit, LIMITS } from './limits';
import type {
  SkippedItem,
  WorkloadManifest,
  WorkloadQuery,
  WorkloadStatement,
} from './types';

export type IngestResult = {
  readonly statements: readonly IngestedStatement[];
  readonly skipped: readonly SkippedItem[];
};

export type IngestedStatement = {
  readonly queryName: string;
  readonly statement: WorkloadStatement;
  readonly normalizedSql: string;
};

function validateStatement(
  queryName: string,
  stmt: WorkloadStatement,
  index: number
): WorkloadStatement {
  assert.ok(
    stmt.sql.length > 0,
    `query ${queryName} stmt ${String(index)}: empty sql`
  );
  assert.ok(
    stmt.fingerprint.length === 64,
    `query ${queryName} stmt ${String(index)}: fingerprint must be sha256 hex`
  );
  assert.ok(
    stmt.weight > 0,
    `query ${queryName} stmt ${String(index)}: weight > 0`
  );
  const recomputed = fingerprintSql(stmt.sql);
  assert.ok(
    recomputed === stmt.fingerprint,
    `query ${queryName} stmt ${String(index)}: fingerprint mismatch`
  );
  return stmt;
}

function sortQueries(queries: readonly WorkloadQuery[]): WorkloadQuery[] {
  assertWithinLimit(queries.length, LIMITS.maxStatements, 'manifest.queries');
  const sorted = [...queries].sort((a, b) => a.name.localeCompare(b.name));
  let totalStmts = 0;
  for (let i = 0; i < sorted.length; i++) {
    const q = sorted[i]!;
    assert.ok(q.name.length > 0, 'query name required');
    assertWithinLimit(
      q.statements.length,
      LIMITS.maxStatements,
      `query ${q.name} statements`
    );
    totalStmts += q.statements.length;
  }
  assertWithinLimit(totalStmts, LIMITS.maxStatements, 'total statements');
  return sorted;
}

/**
 * Ingest + validate manifest. Allocates output up front from input sizes.
 * O(S) in statement count.
 */
export function ingestManifest(manifest: WorkloadManifest): IngestResult {
  assert.ok(manifest !== undefined, 'manifest required');
  assert.ok(manifest.version === 1, 'manifest.version must be 1');
  assert.ok(Array.isArray(manifest.queries), 'manifest.queries required');

  const queries = sortQueries(manifest.queries);
  const capacity = Math.min(
    LIMITS.maxStatements,
    queries.reduce((n, q) => n + q.statements.length, 0)
  );
  const statements: IngestedStatement[] = new Array(capacity);
  const skipped: SkippedItem[] = [];
  let write = 0;

  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi]!;
    if (q.statements.length === 0) {
      skipped.push({
        reason: 'zero_statements',
        detail: `query ${q.name} has zero statements`,
        queryName: q.name,
      });
      continue;
    }
    for (let si = 0; si < q.statements.length; si++) {
      const raw = q.statements[si]!;
      const stmt = validateStatement(q.name, raw, si);
      const normalizedSql = normalizeSql(stmt.sql);
      assert.ok(write < capacity, 'ingest write past capacity');
      statements[write] = {
        queryName: q.name,
        statement: stmt,
        normalizedSql,
      };
      write += 1;
    }
  }

  assert.ok(write <= capacity, 'ingest overflow');
  return {
    statements: statements.slice(0, write),
    skipped,
  };
}
