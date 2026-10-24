import { expect, test } from 'bun:test';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import { serverEnforcementLayer } from '@libs/permissions-shared-ts/server';
import { SPACE_TABLES } from '@libs/spaces-harness-ts/space-decision-world';
import {
  performCustomGameDecision,
  seedCustomGameDecision,
} from './dmn/custom-game-decision-operations';

test.each([
  'start a custom game',
  'play a custom game',
  'cancel a custom game',
])('a host can %s with Battleship private setups', async (capability) => {
  // regression: custom-game-decision-private-setup
  const battleship = HARNESS_GAMES.find(
    (game) => game.shared.id === 'battleship'
  );
  if (battleship === undefined) throw new Error('Battleship is not registered');
  const layer = serverEnforcementLayer({
    tables: SPACE_TABLES,
    seed: seedCustomGameDecision,
    operationFor: () => performCustomGameDecision([battleship]),
  });
  expect(
    await layer.decide(
      {
        'who is asking': 'free account',
        'their place in the space': 'host',
        'what they want to do': capability,
      },
      { decisionId: 'custom-game-access', caseId: capability, world: undefined }
    )
  ).toEqual({ answer: 'yes' });
});
