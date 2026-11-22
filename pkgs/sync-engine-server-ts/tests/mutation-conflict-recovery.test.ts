import { expect, test } from 'bun:test';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { conflictHost } from './mutation-conflict-fixture';

const serialization = Object.assign(
  new Error('could not serialize access due to concurrent update'),
  { code: '40001' }
);
const deadlock = Object.assign(new Error('deadlock detected'), {
  code: '40P01',
});

// regression: mutation-serializable-conflict-escapes-request
test('a commit conflict starts a fresh transaction and acknowledges one durable save', async () => {
  const host = await conflictHost([serialization, deadlock]);
  try {
    const response = await host.post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      verdicts: [{ mutationId: 'save-1', status: 'applied' }],
      ackSeq: 1,
    });
    expect(host.attempts()).toBe(3);
    expect(host.committed()).toBe(1);
    expect(
      await host.db.query(
        sql<{
          mutation_id: string;
        }>`SELECT mutation_id FROM sync_engine_mutations_applied`
      )
    ).toEqual([{ mutation_id: 'save-1' }]);
    expect(
      await host.db.query(
        sql<{
          mutation_id: string;
        }>`SELECT mutation_id FROM sync_engine_observability_events`
      )
    ).toEqual([{ mutation_id: 'save-1' }]);
  } finally {
    await host.db.disconnect();
  }
});

test.each([
  ['persistent conflicts', Array.from({ length: 7 }, () => serialization), 6],
  ['unclassified errors', [new Error('connection lost')], 1],
])(
  '%s remain failures without an unbounded replay loop',
  async (_name, failures, attempts) => {
    const host = await conflictHost(failures);
    try {
      expect((await host.post()).status).toBe(500);
      expect(host.attempts()).toBe(attempts);
      expect(host.committed()).toBe(0);
      expect(
        await host.db.query(
          sql<{
            mutation_id: string;
          }>`SELECT mutation_id FROM sync_engine_mutations_applied`
        )
      ).toEqual([]);
    } finally {
      await host.db.disconnect();
    }
  }
);

test('a post-commit listener failure never replays the committed transaction', async () => {
  const host = await conflictHost([], async () => {
    throw serialization;
  });
  try {
    expect((await host.post()).status).toBe(500);
    expect(host.attempts()).toBe(1);
    expect(host.committed()).toBe(1);
    expect(
      await host.db.query(
        sql<{
          mutation_id: string;
        }>`SELECT mutation_id FROM sync_engine_mutations_applied`
      )
    ).toEqual([{ mutation_id: 'save-1' }]);
  } finally {
    await host.db.disconnect();
  }
});
