import { expect } from 'bun:test';
import { inMatchedGame } from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { openCustomGames } from '@libs/game-session-harness-ts/game-navigation';
import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { Given, Then, When } from '@libs/harness-ts/define';
import { remember } from '@libs/harness-ts/spec-world';
import { leaveSpace } from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import {
  choose,
  chosen,
  current,
  inSpace,
  toldOf,
} from './custom-game-set-up-world';
import { gameOf, hostOf, setupCustomGame, turnGameOf } from './game-world';
import { onlyWatches } from './matched-game-watchers.steps';
import { boardTakesNoMove, playsPuzzles } from './puzzle-world';

Given(
  '{actor} and {actor} have a custom game after their first moves',
  async (w) =>
    setupCustomGame(w, {
      moves: turnGameOf(w).fixtures.firstSideVictory.slice(0, 2),
    })
);
Given(
  '{actor} has left the space after claiming the {gameSide}',
  async (w, person: string, side: CustomGameSide) => {
    // The link the person can join from again later.
    remember(w, 'spaceLink', await w.s.read(readSpaceLink, hostOf(w)));
    await inSpace(w, person);
    await chosen(w, person, { operation: 'claim', side });
    await w.s.apply(leaveSpace, person);
  }
);
Given(
  '{actor} has claimed the {gameSide}',
  async (w, person: string, side: CustomGameSide) => {
    await inSpace(w, person);
    await chosen(w, person, { operation: 'claim', side });
  }
);

When('{actor} cancels the custom game', async (w, actor: string) =>
  choose(w, actor, { operation: 'cancel' })
);

Then('the custom game is cancelled with no result', async (w) => {
  const game = await current(w);
  expect(game.status).toBe('cancelled');
  expect(game.outcome).toBe('cancelled');
});
Then('neither side has an invitation', async (w) => {
  const game = await current(w);
  expect(game.white.kind).not.toBe('invitation');
  expect(game.black.kind).not.toBe('invitation');
});
Then('{actor} cannot make a move', async (w, actor: string) => {
  // On a puzzle's board, the board takes no move.
  if (playsPuzzles(w, actor)) return boardTakesNoMove(w, actor);
  // A guest watching a matched game has no side in it.
  if (inMatchedGame(w)) return onlyWatches(w, actor);
  await w.s.apply(openCustomGames, actor, gameOf(w).shared.id);
  const seen = await w.s.read(customGameView, actor);
  expect(seen.gates['move'] ?? false).toBe(false);
});
Then(
  '{actor} is told only the creator cancels the custom game',
  async (w, actor: string) =>
    toldOf(
      w,
      actor,
      'only the creator cancels the Custom Game',
      'only the creator'
    )
);
Then(
  '{actor} is told to resign instead of cancelling',
  async (w, actor: string) => toldOf(w, actor, 'resign instead')
);
