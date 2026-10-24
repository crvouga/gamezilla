import { expect, test } from 'bun:test';
import { QUORIDOR_HILL_PLAYABLE } from '@libs/quoridor-harness-ts/quoridor-playable';
import { completeCustomGameParty } from '@libs/runtime-harness-ts/custom-game-party-journey';
import { delayedPartyHost } from './custom-game-party-fixture';

// regression: party-journey-replays-stale-peer-turn
test('the party waits for the last accepted turn before choosing the next person', async () => {
  const { host, players, moves } = delayedPartyHost();
  const result = await completeCustomGameParty(host, QUORIDOR_HILL_PLAYABLE);
  expect(moves.slice(0, 4)).toEqual(['e2', 'b5', 'e8', 'h5']);
  expect(result.status).toBe('completed');
  expect(result.outcome).not.toBe('');
  expect(result.ply).toBe(moves.length);
  expect(players).toEqual(
    players.map((_, i) => (i % 2 === 0 ? 'white' : 'black'))
  );
});
