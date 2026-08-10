import { describe, expect, test } from 'bun:test';
import { defineQuery, queryRegistry } from '@pkgs/sync-engine/shared';
import { QueryLimitExceeded, runQuery } from '../../queries/server/run-query';

describe('strict default query limit', () => {
  test('throws QueryLimitExceeded when default budget clips under strictQueryLimits', async () => {
    const q = defineQuery({
      name: 'defaultBudgetBlast',
      async run() {
        const notes = Array.from({ length: 2001 }, (_, i) => ({
          id: `n${i}`,
          deleted_at: null,
        }));
        return { notes };
      },
    });
    expect(q.limitIsDefault).toBe(true);

    await expect(
      runQuery(
        {
          db: { query: async () => [] },
          registry: queryRegistry([q]),
          auth: {
            actorId: 'a1',
            deviceId: 'd1',
            accountId: null,
            isAnon: false,
            now: () => new Date(0),
          },
          nextCheckpoint: () => 'cp-1',
          strictQueryLimits: true,
        },
        { name: 'defaultBudgetBlast', params: {} }
      )
    ).rejects.toBeInstanceOf(QueryLimitExceeded);
  });

  test('explicit budget still truncates silently under strictQueryLimits', async () => {
    const q = defineQuery({
      name: 'explicitBudget',
      limit: 5,
      async run() {
        const notes = Array.from({ length: 12 }, (_, i) => ({
          id: `n${i}`,
          deleted_at: null,
        }));
        return { notes };
      },
    });
    expect(q.limitIsDefault).toBe(false);

    const res = await runQuery(
      {
        db: { query: async () => [] },
        registry: queryRegistry([q]),
        auth: {
          actorId: 'a1',
          deviceId: 'd1',
          accountId: null,
          isAnon: false,
          now: () => new Date(0),
        },
        nextCheckpoint: () => 'cp-1',
        strictQueryLimits: true,
      },
      { name: 'explicitBudget', params: {} }
    );
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.tables['notes']?.length).toBe(5);
    }
  });
});
