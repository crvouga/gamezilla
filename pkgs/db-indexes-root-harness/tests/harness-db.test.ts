import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/db-indexes-root-harness/clock';
import { HarnessDb } from '@pkgs/db-indexes-root-harness/db';
import { ownedIndexName } from '@pkgs/db-indexes-root-shared/naming';
import type { IndexDefinition } from '@pkgs/db-indexes-root-shared/types';

function def(table: string, col: string): IndexDefinition {
  return {
    table,
    columns: [{ name: col, order: 'asc' }],
    include: [],
    predicate: null,
  };
}

describe('HarnessDb', () => {
  test('create then introspect owned index', async () => {
    const clock = createHarnessClock(0);
    const db = new HarnessDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
    });
    const definition = def('notes', 'user_id');
    const name = ownedIndexName(definition);
    const result = await db.execute(
      {
        kind: 'create',
        name,
        definition,
        estimatedMs: 100,
        table: 'notes',
        priority: 1,
      },
      10_000
    );
    expect(result.status).toBe('ok');
    const indexes = await db.introspectIndexes();
    expect(indexes.some((i) => i.name === name && i.isOwned)).toBe(true);
  });

  test('execute refuses non-owned name', async () => {
    const clock = createHarnessClock(0);
    const db = new HarnessDb({ clock, tables: [] });
    let threw = false;
    try {
      await db.execute(
        {
          kind: 'drop',
          name: 'ix_notes_deadbeef' as never,
          definition: null,
          estimatedMs: 10,
          table: 'notes',
          priority: 0,
        },
        10_000
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('evaluateCandidates returns improvements', async () => {
    const clock = createHarnessClock(0);
    const db = new HarnessDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      defaultImprovement: 8,
    });
    const definition = def('notes', 'user_id');
    const name = ownedIndexName(definition);
    const evals = await db.evaluateCandidates(
      [],
      [
        {
          definition,
          name,
          sourceQuery: 'q',
          sourceStatementIndex: 0,
          weight: 1,
        },
      ]
    );
    expect(evals[0]!.improvement).toBe(8);
  });
});
