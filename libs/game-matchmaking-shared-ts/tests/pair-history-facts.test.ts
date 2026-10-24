import { expect, test } from 'bun:test';
import { MultiplayerGameRepository } from '@libs/game-matchmaking-shared-ts/game-repository';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';

test('one history read preserves unfinished counts and completed colour balances', async () => {
  let reads = 0;
  const rows = [
    { white_id: 'alice', black_id: 'bob', outcome: 'white' },
    { white_id: 'bob', black_id: 'alice', outcome: 'draw' },
    { white_id: 'alice', black_id: 'carol', outcome: 'aborted' },
    { white_id: 'bob', black_id: 'dave', outcome: 'ongoing' },
    { white_id: 'carol', black_id: 'dave', outcome: 'black' },
    { white_id: 'alice', black_id: 'dave', outcome: 'ongoing' },
  ];
  const tx: SqlTx = {
    query: async () => {
      reads++;
      return rows as never;
    },
    run: async () => {
      throw new Error('history reads must not write');
    },
  };
  const facts = await new MultiplayerGameRepository(tx).matchmakingFacts([
    'alice',
    'bob',
    'carol',
  ]);
  expect([...facts]).toEqual([
    ['alice', { unfinished: 1, colourBalance: 0 }],
    ['bob', { unfinished: 1, colourBalance: 0 }],
    ['carol', { unfinished: 0, colourBalance: 1 }],
  ]);
  expect(reads).toBe(1);
});
