import { describe, expect, test } from 'bun:test';
import { defineRule } from '@pkgs/rules/core/define-rule';
import { fail } from '@pkgs/rules/core/fail';
import { isRulesReject } from '@pkgs/rules/core/rules-reject';
import type { RulesAuth } from '@pkgs/rules/core/types';
import type { Sql, Value } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { validatedWrite } from './validated-write';

const auth: RulesAuth = {
  userId: 'me',
};

type CrudRow = { id: number; tx_id: number | null; data: string };

function createMemoryClient(state: {
  crud: CrudRow[];
  wrote: boolean;
}): SqlClient {
  const client: SqlClient = {
    connect: async () => {},
    disconnect: async () => {},
    query: async <T>(query: Sql) => {
      if (query.sql.includes('MAX(id)') && query.sql.includes('ps_crud')) {
        const max = state.crud.reduce((m, r) => Math.max(m, r.id), 0);
        return [{ max_id: max || null }] as T[];
      }
      if (query.sql.includes('FROM ps_crud WHERE id >')) {
        const watermark = Number(query.values[0] ?? 0);
        return state.crud.filter((r) => r.id > watermark) as T[];
      }
      return [] as T[];
    },
    run: async () => ({ changes: 1, lastInsertRowid: 0 }),
    transaction: async (fn) => {
      const snapshot = state.crud.map((r) => ({ ...r }));
      const wroteBefore = state.wrote;
      try {
        return await fn(client);
      } catch (e) {
        state.crud.length = 0;
        state.crud.push(...snapshot);
        state.wrote = wroteBefore;
        throw e;
      }
    },
    prepare: (query: Sql) => ({
      query: async (params?: Value[]) => {
        const next: Sql =
          params === undefined
            ? query
            : Object.assign(
                Object.create(Object.getPrototypeOf(query)),
                query,
                {
                  values: params,
                }
              );
        return client.query(next);
      },
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    }),
  };
  return client;
}

describe('validatedWrite', () => {
  test('rolls back when after rule fails', async () => {
    const state = { crud: [] as CrudRow[], wrote: false };
    const db = createMemoryClient(state);
    const rejectOther = defineRule({
      name: 'test/OWN',
      phase: 'after',
      touches: ['widgets'],
      check: async (ctx) =>
        ctx.batch.rows
          .filter((r) => r.id !== ctx.auth.userId)
          .map((r) => fail('NOT_OWN', { table: r.table, id: r.id })),
    });

    try {
      await validatedWrite({
        sql: db,
        auth,
        rules: [rejectOther],
        fn: async () => {
          state.wrote = true;
          state.crud.push({
            id: 1,
            tx_id: 1,
            data: JSON.stringify({
              op: 'PUT',
              type: 'widgets',
              id: 'other',
              data: { name: 'x' },
            }),
          });
          return 'ok';
        },
      });
      expect.unreachable('expected RulesReject');
    } catch (e) {
      expect(isRulesReject(e)).toBe(true);
    }

    expect(state.wrote).toBe(false);
    expect(state.crud).toHaveLength(0);
  });

  test('commits when after rule passes', async () => {
    const state = { crud: [] as CrudRow[], wrote: false };
    const db = createMemoryClient(state);
    const allowOwn = defineRule({
      name: 'test/OWN',
      phase: 'after',
      touches: ['widgets'],
      check: async () => [],
    });

    const result = await validatedWrite({
      sql: db,
      auth,
      rules: [allowOwn],
      fn: async () => {
        state.wrote = true;
        state.crud.push({
          id: 1,
          tx_id: 1,
          data: JSON.stringify({
            op: 'PUT',
            type: 'widgets',
            id: 'me',
            data: { name: 'x' },
          }),
        });
        return 'ok';
      },
    });

    expect(result).toBe('ok');
    expect(state.wrote).toBe(true);
    expect(state.crud).toHaveLength(1);
  });
});
