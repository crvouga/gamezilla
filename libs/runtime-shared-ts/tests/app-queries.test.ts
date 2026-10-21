import { describe, expect, test } from 'bun:test';
import { APP_QUERIES } from '@libs/runtime-shared-ts/app-queries';
import { appSchema } from '@libs/runtime-shared-ts/app-schema';
import { analyzeIndexability } from '@pkgs/db-indexes-root-shared-ts/indexability';
import type { SchemaIndex } from '@pkgs/db-indexes-root-shared-ts/schema-coverage';
import { pkSchemaIndexes } from '@pkgs/db-indexes-root-shared-ts/schema-coverage';
import {
  assertQueryRegistryIndexable,
  extractWorkload,
} from '@pkgs/sync-engine-shared-ts/extract-workload';

const CATALOG_TABLES = new Set<string>(['client_config']);

function schemaIndexesFromApp(): readonly SchemaIndex[] {
  const snap = appSchema.snapshot();
  const tables = Object.keys(snap.tables).sort();
  const out: SchemaIndex[] = [...pkSchemaIndexes(tables)];
  for (const ix of snap.indexes) {
    const [table, ...columns] = ix;
    out.push({ table, columns });
  }
  for (const ix of snap.uniqueIndexes) {
    const [table, ...columns] = ix;
    out.push({ table, columns });
  }
  return out;
}

describe('APP_QUERIES indexability', () => {
  // regression: chess-multiplayer-session-indexability
  test('every defineQuery statement is indexable (PK / schema / autoidx / catalog)', async () => {
    const schemaIndexes = schemaIndexesFromApp();
    await assertQueryRegistryIndexable(APP_QUERIES, {
      schemaIndexes,
      catalogTables: CATALOG_TABLES,
    });
  });

  test('analyze report has zero gaps and classifies every statement', async () => {
    const manifest = await extractWorkload(APP_QUERIES);
    const report = analyzeIndexability({
      manifest,
      schemaIndexes: schemaIndexesFromApp(),
      catalogTables: CATALOG_TABLES,
    });
    expect(report.gaps).toEqual([]);
    expect(report.classified).toBeGreaterThan(0);
    const stmtCount = manifest.queries.reduce(
      (n, q) => n + q.statements.length,
      0
    );
    expect(report.classified).toBe(stmtCount);
  });
});
