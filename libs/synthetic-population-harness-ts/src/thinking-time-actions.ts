/** How long a Synthetic User thinks about its moves, as people see it. */
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { setPlaySetup } from './live-synthetic-users';
import { movesSeenBy } from './moves-seen';
import { syntheticBoardOf } from './synthetic-user-reads';

const SECOND_MS = 1000;

/**
 * The Synthetic User's previous move took `seconds` seconds; its persona
 * thinks for a second either side of that, and its next draw falls on the
 * same whole second, so only the rule can make this move's time differ.
 */
export const givenPreviousThinkingTime = scenarioAction({
  name: 'givenPreviousThinkingTime',
  act: (s, name: string, seconds: number) => {
    setPlaySetup(s, name, {
      persona: {
        thinkingTime: {
          minMs: (seconds - 1) * SECOND_MS,
          maxMs: (seconds + 1) * SECOND_MS + SECOND_MS - 1,
        },
      },
      memory: { previousThinkingMs: seconds * SECOND_MS + 100 },
      random: () => 0.5,
    });
  },
});

/** The first move the person saw the Synthetic User make: how long it took, and whether the game allows it. */
export function firstMoveSeen(s: ProductHarness, person: string) {
  return movesSeenBy(s, person)[0] ?? null;
}

/** Whether it is the Synthetic User's move, as its own device shows. */
export async function syntheticUserToMove(s: ProductHarness, name: string) {
  return (await syntheticBoardOf(s, name)).canMove;
}
