import { expect, test } from 'bun:test';
import { givenOpponentSearch } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import type { ProductHarness } from '@libs/harness/harness';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';

// regression: matchmaking-fixture-nested-connection-read
test('search setup resolves the actor and space before opening its write transaction', async () => {
  let writing = false;
  let reads = 0;
  const clock = { now: () => 1000 };
  const query = async () => {
    if (writing)
      throw new Error('root connection read during write transaction');
    reads += 1;
    return [{ user_id: 'alice', expires_at: new Date(10000), id: 'space' }];
  };
  const stop = async () => {
    throw new Error('mutation uses transaction');
  };
  const sqlClient = {
    query,
    transaction: async (run: (tx: SqlTx) => Promise<unknown>) => {
      writing = true;
      try {
        return await run({ query: stop, run: stop } as unknown as SqlTx);
      } finally {
        writing = false;
      }
    },
  };
  const s = {
    actors: new Map([
      [
        'alice',
        {
          sessionToken: async () => 'token',
          currentPath: async () => '/space/space',
        },
      ],
    ]),
    harness: {
      client: async () => ({}),
      clock,
      serverSql: { sqlClient },
      server: { clock, createId: () => 'request' },
      composition: {
        app: { turnGames: { forControl: () => ({ id: 'counting' }) } },
      },
    },
  } as unknown as ProductHarness;
  await expect(
    Promise.resolve(
      givenOpponentSearch.act(s, 'alice', 'counting/5+0', 'search')
    )
  ).rejects.toThrow('mutation uses transaction');
  expect(reads).toBe(3);
});
