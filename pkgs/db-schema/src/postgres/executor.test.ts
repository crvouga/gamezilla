import { describe, expect, test } from 'bun:test';
import type { Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { defineSchema } from '../core/define-schema';
import { planServer } from '../core/plan';
import { createRecordingPostgresClient } from '../test/fake-sql-client';
import { emptyCatalog } from '../test/fixtures';
import { postgres } from './driver';
import { emitServerOperation } from './emit';

describe('postgres executor with fake client', () => {
  test('table DDL runs inside transaction; indexes CONCURRENTLY outside', async () => {
    const events: string[] = [];
    const schema = defineSchema({
      tables: { notes: { body: 'text' } },
      indexes: [['notes', 'body']],
    });

    const client = createRecordingPostgresClient(
      createPostgresDbScope('test'),
      {
        async query(q) {
          events.push(`query:${q.sql.slice(0, 40)}`);
          if (/pg_advisory_lock/.test(q.sql)) {
            return [{ locked: true }] as never;
          }
          if (/pg_advisory_unlock/.test(q.sql)) {
            return [{ unlocked: true }] as never;
          }
          return [] as never;
        },
        async run(q) {
          events.push(`run:${q.sql}`);
          return { changes: 0, lastInsertRowid: 0 };
        },
        async transaction(fn) {
          events.push('txn:begin');
          const tx: SqlClient = {
            connect: async () => {},
            disconnect: async () => {},
            query: async (q: Sql<Record<string, unknown>>) => {
              events.push(`tx.query:${q.sql.slice(0, 40)}`);
              return [];
            },
            run: async (q: Sql<unknown>) => {
              events.push(`tx.run:${q.sql}`);
              return { changes: 0, lastInsertRowid: 0 };
            },
            transaction: async (inner) => inner(tx),
            prepare: () => ({
              query: async () => [],
              run: async () => ({ changes: 0, lastInsertRowid: 0 }),
            }),
          };
          const result = await fn(tx);
          events.push('txn:end');
          return result;
        },
      }
    );

    await postgres(schema, client).reconcile();

    const txnBegin = events.indexOf('txn:begin');
    const txnEnd = events.indexOf('txn:end');
    expect(txnBegin).toBeGreaterThanOrEqual(0);
    expect(txnEnd).toBeGreaterThan(txnBegin);

    const createTableInTxn = events.some(
      (e, i) =>
        e.startsWith('tx.run:') &&
        /CREATE TABLE/i.test(e) &&
        i > txnBegin &&
        i < txnEnd
    );
    expect(createTableInTxn).toBe(true);

    const concurrentOutside = events.some(
      (e, i) =>
        e.startsWith('run:') &&
        /CREATE INDEX CONCURRENTLY/i.test(e) &&
        (i < txnBegin || i > txnEnd)
    );
    expect(concurrentOutside).toBe(true);
  });
});

describe('plan vs emit corpus', () => {
  test('fresh plan emits only additive kinds', () => {
    const schema = defineSchema({
      tables: { a: { x: 'text' } },
      indexes: [['a', 'x']],
    });
    const plan = planServer(schema._declared, emptyCatalog());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    for (const op of plan.operations) {
      expect([
        'create_table',
        'add_column',
        'create_index',
        'drop_index',
      ]).toContain(op.kind);
      const text = emitServerOperation(op).sql;
      expect(text).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/i);
    }
  });
});
