import { describe, expect, test } from 'bun:test';
import { logicalTypeMatch } from '@pkgs/db-schema/core/compatibility';
import { defineSchema } from '@pkgs/db-schema/core/define-schema';
import { planServer } from '@pkgs/db-schema/core/plan';
import { readPostgresCatalog } from '../src/catalog';
import { postgres } from '../src/driver';
import { createPostgresMemTestClient } from '../src/test/postgres-mem-test-client';

describe('postgres logical type vs physical catalog type', () => {
  test('logical integer matches bigint, not int4', () => {
    expect(logicalTypeMatch('integer', 'bigint', 'postgres')).toBe(true);
    expect(logicalTypeMatch('integer', 'int4', 'postgres')).toBe(false);
  });

  test('an explicit int4 override matches int4', () => {
    expect(
      logicalTypeMatch('integer', 'int4', 'postgres', {
        type: 'integer',
        physicalPostgres: 'int4',
      })
    ).toBe(true);
  });

  test('logical text matches text, not varchar', () => {
    expect(logicalTypeMatch('text', 'text', 'postgres')).toBe(true);
    expect(logicalTypeMatch('text', 'varchar', 'postgres')).toBe(false);
  });

  test('an explicit varchar override matches varchar', () => {
    expect(
      logicalTypeMatch('text', 'varchar', 'postgres', {
        type: 'text',
        physicalPostgres: 'varchar',
      })
    ).toBe(true);
  });
});

describe('postgres physical override end-to-end', () => {
  test('catalog reports the raw physical type and drives drift', async () => {
    const harness = await createPostgresMemTestClient('physical_override');
    try {
      const schema = defineSchema({
        tables: { metrics: { rating: { type: 'integer', postgres: 'int4' } } },
      });
      await postgres(schema, harness.sqlClient, {
        skipAdvisoryLock: true,
      }).reconcile();

      const catalog = await readPostgresCatalog(
        harness.sqlClient,
        schema._declared
      );
      const rating = catalog.tables
        .get('metrics')
        ?.columns.find((c) => c.name === 'rating');
      expect(rating?.physical).toBe('int4');
      expect(rating?.type).toBe('integer');

      const idempotent = planServer(schema._declared, catalog);
      expect(idempotent.ok).toBe(true);
      if (!idempotent.ok) return;
      expect(idempotent.operations).toEqual([]);

      // The same column declared without the override expects bigint, so the
      // int4 catalog column is drift.
      const plain = defineSchema({
        tables: { metrics: { rating: 'integer' } },
      });
      const drift = planServer(plain._declared, catalog);
      expect(drift.ok).toBe(false);
      if (drift.ok) return;
      expect(drift.drift.map((d) => d.path)).toContain('metrics.rating');
    } finally {
      await harness.close();
    }
  });
});
