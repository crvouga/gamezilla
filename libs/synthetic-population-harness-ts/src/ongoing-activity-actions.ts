import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { syntheticContinuity } from './continuity-actions';
import { playSyntheticCurrentGame } from './play-current-game';

export const continueSyntheticActivity = scenarioAction({
  name: 'continueSyntheticActivity',
  act: (s) => playSyntheticCurrentGame(s, () => undefined),
});

export async function observeOngoingActivity(
  s: ProductHarness,
  initial: Awaited<ReturnType<typeof syntheticContinuity>>
) {
  const current = await syntheticContinuity(s);
  return {
    identity:
      current.account !== null && current.account === initial.account
        ? 'Cedar'
        : 'Unknown',
    activity: {
      tag:
        current.board.outcome === 'ongoing'
          ? 'Playing'
          : ['white', 'black', 'draw'].includes(current.board.outcome ?? '')
            ? 'Finished'
            : 'Unavailable',
      value: [],
    },
    game:
      current.board.gameId === initial.board.gameId &&
      current.board.gameId !== null
        ? 'friday-pong'
        : (current.board.gameId ?? ''),
  };
}
