import { expect, test } from 'bun:test';
import { serverEnforcementLayer } from '@libs/permissions-shared-ts/server';
import { SPACE_TABLES } from '@libs/spaces-harness-ts/space-decision-world';
import { gamesHeldTo } from './conformance-world';
import {
  performCustomGameDecision,
  seedCustomGameDecision,
} from './dmn/custom-game-decision-operations';

const layer = serverEnforcementLayer({
  tables: SPACE_TABLES,
  seed: seedCustomGameDecision,
  operationFor: () =>
    performCustomGameDecision(
      gamesHeldTo('specs/games/custom-game-access.dmn')
    ),
});

// regression: custom-game-access-fixture-readiness
test.each([
  ['host', 'start a custom game'],
  ['host', 'play a custom game'],
  ['joined', 'play a custom game'],
  ['joined', 'cancel a custom game'],
] as const)(
  'a guest who is %s can %s for every registered game',
  async (place, capability) => {
    const answer = await layer.decide(
      {
        'who is asking': 'guest',
        'their place in the space': place,
        'what they want to do': capability,
      },
      {
        decisionId: 'custom-game-access',
        caseId: `${place}-${capability}`,
        world: undefined,
      }
    );
    expect(answer).toEqual({ answer: 'yes' });
  }
);
