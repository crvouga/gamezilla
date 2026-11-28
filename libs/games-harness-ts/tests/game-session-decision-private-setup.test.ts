import { expect, test } from 'bun:test';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import { serverEnforcementLayer } from '@libs/permissions-shared-ts/server';
import { SPACE_TABLES } from '@libs/spaces-harness-ts/space-decision-world';
import {
  performGameSessionDecision,
  seedGameSessionDecision,
} from './dmn/game-session-decision-operations';

test.each([
  'start a game session',
  'play a game session',
  'cancel a game session',
])('a host can %s with Battleship private setups', async (capability) => {
  // regression: game-session-decision-private-setup
  const battleship = HARNESS_GAMES.find(
    (game) => game.shared.id === 'battleship'
  );
  if (battleship === undefined) throw new Error('Battleship is not registered');
  const layer = serverEnforcementLayer({
    tables: SPACE_TABLES,
    seed: seedGameSessionDecision,
    operationFor: () => performGameSessionDecision([battleship]),
  });
  expect(
    await layer.decide(
      {
        'who is asking': 'free account',
        'their place in the space': 'host',
        'what they want to do': capability,
      },
      {
        decisionId: 'game-session-access',
        caseId: capability,
        world: undefined,
      }
    )
  ).toEqual({ answer: 'yes' });
});
