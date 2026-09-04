import { describe, expect, test } from 'bun:test';
import { planIndexes, reconcileIndexes } from '@pkgs/db-indexes';
import { createSimClock, SimDb } from '@pkgs/db-indexes/sim';
import { fingerprintSql } from '../src/core/fingerprint';
import { ownedIndexName } from '../src/core/naming';
import type { IndexDefinition, WorkloadManifest } from '../src/core/types';

function stmt(sql: string, index = 0) {
  return {
    index,
    sql,
    fingerprint: fingerprintSql(sql),
    weight: 1,
  };
}

function def(table: string, col: string): IndexDefinition {
  return {
    table,
    columns: [{ name: col, order: 'asc' }],
    include: [],
    predicate: null,
  };
}

describe('SimDb', () => {
  test('create then introspect owned index', async () => {
    const clock = createSimClock(0);
    const db = new SimDb({
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
    const clock = createSimClock(0);
    const db = new SimDb({ clock, tables: [] });
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
    const clock = createSimClock(0);
    const db = new SimDb({
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

describe('planIndexes + reconcileIndexes on SimDb', () => {
  test('creates missing index then fixpoint', async () => {
    const clock = createSimClock(0);
    const db = new SimDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      defaultImprovement: 10,
    });
    const manifest: WorkloadManifest = {
      version: 1,
      queries: [
        {
          name: 'notesByUser',
          hydrates: ['notes'],
          statements: [stmt('SELECT id, title FROM notes WHERE user_id = ?')],
        },
      ],
    };
    const report1 = await reconcileIndexes({
      manifest,
      db,
      clock,
      deadlineMs: 120_000,
      config: { minTableRows: 10_000, createEstimatedMs: 100 },
    });
    expect(report1.completed.some((a) => a.kind === 'create')).toBe(true);

    const report2 = await reconcileIndexes({
      manifest,
      db,
      clock,
      deadlineMs: 120_000,
      config: { minTableRows: 10_000, createEstimatedMs: 100 },
    });
    expect(report2.plan.actions.length).toBe(0);
  });

  test('plan is deterministic across runs', async () => {
    const clock = createSimClock(0);
    const makeDb = () =>
      new SimDb({
        clock,
        tables: [{ name: 'notes', estimatedRows: 50_000 }],
        defaultImprovement: 10,
      });
    const manifest: WorkloadManifest = {
      version: 1,
      queries: [
        {
          name: 'notesByUser',
          hydrates: ['notes'],
          statements: [
            stmt('SELECT id FROM notes WHERE user_id = ? ORDER BY created_at'),
          ],
        },
      ],
    };
    const a = await planIndexes({
      manifest,
      db: makeDb(),
      clock,
      config: { minTableRows: 1 },
    });
    const b = await planIndexes({
      manifest,
      db: makeDb(),
      clock,
      config: { minTableRows: 1 },
    });
    expect(JSON.stringify(a.desired.map((d) => d.name))).toBe(
      JSON.stringify(b.desired.map((d) => d.name))
    );
    expect(JSON.stringify(a.actions.map((x) => x.kind + x.name))).toBe(
      JSON.stringify(b.actions.map((x) => x.kind + x.name))
    );
  });
});
