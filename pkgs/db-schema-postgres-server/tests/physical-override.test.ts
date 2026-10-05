import { describe, expect, test } from 'bun:test';
import { createMockingbirdPostgresTestClient } from '@pkgs/db-schema-postgres-server/mockingbird-postgres-test-client';
import { readPostgresCatalog } from '@pkgs/db-schema-postgres-shared/catalog';
import { postgres } from '@pkgs/db-schema-postgres-shared/driver';
import { logicalTypeMatch } from '@pkgs/db-schema-root-shared/compatibility';
import { defineSchema } from '@pkgs/db-schema-root-shared/define-schema';
import { planServer } from '@pkgs/db-schema-root-shared/plan-server';

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
  test('catalog reports the raw physical type and widens a bare integer', async () => {
    const harness =
      await createMockingbirdPostgresTestClient('physical_override');
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

      // Declared integer with no physical override is bigint, so int4 widens.
      const plain = defineSchema({
        tables: { metrics: { rating: 'integer' } },
      });
      const widened = planServer(plain._declared, catalog);
      expect(widened.ok).toBe(true);
      if (!widened.ok) return;
      expect(
        widened.operations.some(
          (op) => op.kind === 'widen_integer' && op.column === 'rating'
        )
      ).toBe(true);
    } finally {
      await harness.close();
    }
  });
});
