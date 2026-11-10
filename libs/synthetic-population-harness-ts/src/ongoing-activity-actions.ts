import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { syntheticContinuity } from './continuity-actions';
import { carryOnSyntheticUsers } from './live-synthetic-users';
import { playSyntheticCurrentGame } from './play-current-game';
import { syntheticBoardOf } from './synthetic-user-reads';

/** After a game, a while: long enough for anything it does next to show. */
const AFTER_GAME_MS = 30_000;

/**
 * Cedar continues what it is doing: its ongoing game to a result, or, once
 * its game is over, whatever it does next, carrying on as deployed.
 */
export const continueSyntheticActivity = scenarioAction({
  name: 'continueSyntheticActivity',
  act: async (s) => {
    const board = await syntheticBoardOf(s, 'Cedar');
    if (board.gameId === null || board.outcome === 'ongoing') {
      await playSyntheticCurrentGame(s, () => undefined);
      return;
    }
    await carryOnSyntheticUsers(s, {
      maxMs: AFTER_GAME_MS,
      only: (member) => member.actor === 'cedar',
    });
  },
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
