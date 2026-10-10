import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { multiplayerWatcherBoard } from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import { restartApp } from '@libs/harness/actions';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import { bringToFront } from '@libs/harness/observations';
import { readProfileUsernameShown } from '@libs/profile-harness/profile-ui-reads';
import { returnToOwnSpace } from '@libs/spaces-harness/space-actions';
import { Handles } from '@libs/test-ids-shared/handles';
import { completePausedGame } from './synthetic-population-control-actions';
import { givenSyntheticUser } from './synthetic-user-fixtures';

export async function syntheticContinuity(s: ProductHarness) {
  await bringToFront(s, 'cedar');
  return {
    account: await signedInAccountOf(s, 'cedar'),
    board: await multiplayerWatcherBoard(s, 'cedar'),
  };
}
export async function syntheticUsername(s: ProductHarness) {
  await bringToFront(s, 'cedar');
  return readProfileUsernameShown(s, 'cedar');
}
export async function syntheticAvailable(s: ProductHarness) {
  await bringToFront(s, 'cedar');
  const ui = await actorUi(s, 'cedar');
  return (
    (await signedInAccountOf(s, 'cedar')) !== null &&
    (await ui.get(Handles.tabSpaces).isVisible())
  );
}
export async function syntheticGameShown(s: ProductHarness) {
  await Promise.resolve(returnToOwnSpace.act(s, 'cedar'));
  await Promise.resolve(openMultiplayerChess.act(s, 'cedar'));
  return syntheticContinuity(s);
}
export const reopenSyntheticApp = scenarioAction({
  name: 'reopenSyntheticApp',
  act: async (s, gameId: string | null) => {
    await Promise.resolve(restartApp.act(s, 'cedar'));
    if (gameId !== null) {
      await Promise.resolve(returnToOwnSpace.act(s, 'cedar'));
      await Promise.resolve(openMultiplayerChess.act(s, 'cedar', gameId));
    }
  },
});
export const givenFinishedSyntheticGame = scenarioAction({
  name: 'givenFinishedSyntheticGame',
  act: async (s, name: string) => {
    await Promise.resolve(givenSyntheticUser.act(s, name, true));
    await Promise.resolve(completePausedGame.act(s));
    await pollUntil(
      s,
      async () => {
        const board = await multiplayerWatcherBoard(s, 'cedar');
        return board.gameId !== null &&
          board.outcome !== null &&
          board.outcome !== 'ongoing'
          ? board
          : null;
      },
      { maxMs: 15_000, description: 'Cedar sees the completed game result' }
    );
  },
});
export const givenSyntheticContinuity = scenarioAction({
  name: 'givenSyntheticContinuity',
  act: async (s, activity: string) => {
    if (activity === 'Finished')
      await Promise.resolve(givenFinishedSyntheticGame.act(s, 'Cedar'));
    else
      await Promise.resolve(
        givenSyntheticUser.act(s, 'Cedar', activity === 'Playing')
      );
  },
});
export async function observeSyntheticContinuity(
  s: ProductHarness,
  initial: Awaited<ReturnType<typeof syntheticContinuity>>
) {
  const current = await syntheticContinuity(s);
  const gameId = current.board.gameId;
  return {
    identity:
      current.account === initial.account && current.account !== null
        ? 'Cedar'
        : 'Unknown',
    activity: {
      tag:
        gameId === null
          ? 'Browsing'
          : current.board.outcome === 'ongoing'
            ? 'Playing'
            : 'Finished',
      value: [],
    },
    game:
      gameId === null
        ? ''
        : gameId === initial.board.gameId
          ? 'friday-chess'
          : gameId,
  };
}
