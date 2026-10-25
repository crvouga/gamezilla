import { expect, test } from 'bun:test';
import { BATTLESHIP_HARNESS_GAME } from '@libs/battleship-harness-ts/battleship-harness-game';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { serverEnforcementLayer } from '@libs/permissions-shared-ts/server';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';
import { SPACE_TABLES } from '@libs/spaces-harness-ts/space-decision-world';
import {
  performCustomGameDecision,
  seedCustomGameDecision,
} from './dmn/custom-game-decision-operations';

async function answer(game: HarnessGame, place: string, operation: string) {
  const layer = serverEnforcementLayer({
    tables: SPACE_TABLES,
    seed: seedCustomGameDecision,
    operationFor: () => performCustomGameDecision([game]),
  });
  return layer.decide(
    {
      'who is asking': 'guest',
      'their place in the space': place,
      'what they want to do': operation,
    },
    { decisionId: 'custom-game-access', caseId: operation, world: undefined }
  );
}

test('the access probe supplies both private setups before asking to start', async () => {
  // regression: private-setup-access-probe
  expect(
    await answer(BATTLESHIP_HARNESS_GAME, 'host', 'start a custom game')
  ).toEqual({ answer: 'yes' });
});

test('the access probe keeps private-setup players connected before asking to play', async () => {
  // regression: private-setup-access-probe
  expect(
    await answer(BATTLESHIP_HARNESS_GAME, 'joined', 'play a custom game')
  ).toEqual({ answer: 'yes' });
});

test('the access probe waits for the live checkpoint before participant cancellation', async () => {
  // regression: simulation-access-stale-checkpoint
  expect(
    await answer(PONG_HARNESS_GAME, 'joined', 'cancel a custom game')
  ).toEqual({ answer: 'yes' });
});

test('the access probe requires a live player control to be acknowledged', async () => {
  expect(
    await answer(PONG_HARNESS_GAME, 'joined', 'play a custom game')
  ).toEqual({ answer: 'yes' });
});
