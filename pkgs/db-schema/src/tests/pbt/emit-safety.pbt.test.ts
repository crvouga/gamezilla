import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { defineSchema } from '../../core/define-schema';
import { planClient, planServer } from '../../core/plan';
import { emitServerOperation, FORBIDDEN_SERVER_DDL } from '../../postgres/emit';
import {
  emptyCatalog,
  fullTodosTable,
  sampleSchema,
  tableWithColumns,
} from '../../test/fixtures';
import type { IntrospectedCatalog } from '../../core/types';
import { arbSchema } from '../generators';

describe('db-schema emit safety PBT', () => {
  test('legal server plans never emit forbidden DDL', () => {
    assertProperty(
      'no destructive postgres DDL',
      fc.property(arbSchema(), (schema) => {
        const plan = planServer(schema._declared, emptyCatalog());
        if (!plan.ok) return;
        for (const op of plan.operations) {
          const stmt = emitServerOperation(op);
          expect(FORBIDDEN_SERVER_DDL.test(stmt.sql)).toBe(false);
        }
      }),
      { numRuns: 40 }
    );
  });

  test('sample schema corpus never emits forbidden DDL', () => {
    const catalogs = [
      emptyCatalog(),
      {
        tables: new Map([['todos', fullTodosTable()]]),
        indexes: [],
        allTableNames: new Set(['todos']),
      },
    ];
    for (const catalog of catalogs) {
      const plan = planServer(sampleSchema._declared, catalog);
      if (!plan.ok) continue;
      for (const op of plan.operations) {
        const stmt = emitServerOperation(op);
        expect(FORBIDDEN_SERVER_DDL.test(stmt.sql)).toBe(false);
      }
    }
  });

  test('forbidden in-place type change fails on both dialects', () => {
    const v2 = defineSchema({ tables: { notes: { n: 'integer' } } });
    const pgCatalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'notes',
          tableWithColumns('notes', [
            { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'n', type: 'text' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['notes']),
    };
    const liteCatalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'notes',
          tableWithColumns('notes', [
            { name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'TEXT' },
            { name: 'updated_at', type: 'TEXT' },
            { name: 'deleted_at', type: 'TEXT' },
            { name: 'n', type: 'TEXT' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['notes']),
    };
    expect(planServer(v2._declared, pgCatalog).ok).toBe(false);
    expect(planClient(v2._declared, liteCatalog).ok).toBe(false);
  });
});
