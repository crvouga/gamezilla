import { expect, test } from 'bun:test';
import { MultiplayerGameRepository } from '@libs/game-matchmaking-shared-ts/game-repository';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';

// regression: multiseat-colour-balance
test('playing an extra seat does not count as playing the second seat', async () => {
  const tx = {
    query: async () => [
      {
        white_id: 'alice',
        black_id: 'bob',
        red_id: 'carol',
        blue_id: 'dave',
        outcome: 'draw',
      },
      {
        white_id: 'bob',
        black_id: 'alice',
        red_id: 'dave',
        blue_id: 'carol',
        outcome: 'draw',
      },
    ],
  } as unknown as SqlTx;
  const people = await new MultiplayerGameRepository(tx).matchmakingFacts([
    'carol',
  ]);
  expect(people.get('carol')?.colourBalance).toBe(0);
});
