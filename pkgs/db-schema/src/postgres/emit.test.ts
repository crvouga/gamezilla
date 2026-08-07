import { describe, expect, test } from 'bun:test';
import { fingerprintForIndexDef } from '../core/index-fingerprint';
import { planServer } from '../core/plan';
import type { IntrospectedCatalog } from '../core/types';
import { emitServerOperation, FORBIDDEN_SERVER_DDL } from '../postgres/emit';
import { emptyCatalog, fullTodosTable, sampleSchema } from '../test/fixtures';

describe('postgres emitter safety', () => {
  test('never emits destructive DDL across plan corpus', () => {
    const catalogs: IntrospectedCatalog[] = [
      emptyCatalog(),
      {
        tables: new Map([['todos', fullTodosTable()]]),
        indexes: [],
        allTableNames: new Set(['todos']),
      },
      {
        tables: new Map([['todos', fullTodosTable()]]),
        indexes: [
          {
            name: fingerprintForIndexDef(['todos', 'title']),
            table: 'todos',
            columns: ['title'],
          },
        ],
        allTableNames: new Set(['todos']),
      },
    ];

    for (const catalog of catalogs) {
      const plan = planServer(sampleSchema._declared, catalog);
      if (!plan.ok) continue;
      for (const op of plan.operations) {
        const stmt = emitServerOperation(op);
        expect(FORBIDDEN_SERVER_DDL.test(stmt.sql)).toBe(false);
        expect(FORBIDDEN_SERVER_DDL.test(stmt.text)).toBe(false);
      }
    }
  });

  test('create_index uses CONCURRENTLY', () => {
    const plan = planServer(sampleSchema._declared, emptyCatalog());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const ix = plan.operations.find((o) => o.kind === 'create_index');
    expect(ix).toBeTruthy();
    if (!ix || ix.kind !== 'create_index') return;
    expect(emitServerOperation(ix).sql).toContain('CONCURRENTLY');
  });
});
