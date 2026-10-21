import { TURN_GAMES } from '@libs/game-catalog-shared-ts/turn-games';
import { restartApp } from '@libs/harness-ts/actions';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import { readProfileUsernameShown } from '@libs/profile-harness-ts/profile-ui-reads';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { openSyntheticGame, syntheticGameView } from './synthetic-game-actions';
import { completePausedGame } from './synthetic-population-control-actions';
import { givenSyntheticUser } from './synthetic-user-fixtures';

export async function syntheticContinuity(s: ProductHarness) {
  await bringToFront(s, 'cedar');
  return {
    account: await signedInAccountOf(s, 'cedar'),
    board: await syntheticGameView(s, 'cedar'),
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
  await Promise.resolve(openSyntheticGame.act(s, 'cedar'));
  return syntheticContinuity(s);
}
export const reopenSyntheticApp = scenarioAction({
  name: 'reopenSyntheticApp',
  act: async (s, gameId: string | null) => {
    const path = await s.actors.get('cedar')!.currentPath();
    await Promise.resolve(restartApp.act(s, 'cedar'));
    if (gameId !== null) {
      await s.actors.get('cedar')!.openLink(path);
      await Promise.resolve(openSyntheticGame.act(s, 'cedar'));
    }
  },
});
export const givenFinishedSyntheticGame = scenarioAction({
  name: 'givenFinishedSyntheticGame',
  act: async (s, name: string, game?: string) => {
    await Promise.resolve(givenSyntheticUser.act(s, name, true, game));
    await Promise.resolve(completePausedGame.act(s));
    await pollUntil(
      s,
      async () => {
        const board = await syntheticGameView(s, 'cedar');
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
  act: async (s, activity: string, game?: string) => {
    if (activity === 'Finished')
      await Promise.resolve(givenFinishedSyntheticGame.act(s, 'Cedar', game));
    else
      await Promise.resolve(
        givenSyntheticUser.act(s, 'Cedar', activity === 'Playing', game)
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
          ? `friday-${TURN_GAMES.forPosition(initial.board.position ?? '').id}`
          : gameId,
  };
}
