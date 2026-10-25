/**
 * Reviewing an earlier position of a matched game on one's own device,
 * whichever game it is: the board shows the position the game was in after
 * that move, marked as an earlier position, takes no move, and keeps it
 * while later moves are accepted, until its person returns.
 */

import { expect } from 'bun:test';
import {
  acceptedMoves,
  boardBeforeMove,
  matchedGameOf,
  pairOf,
  viewerOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import {
  type MultiplayerBoardShown,
  multiplayerBoardShown,
} from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { shownMultiplayerText } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import type { MultiplayerReviewStep } from '@libs/game-matchmaking-harness-ts/multiplayer-review';
import {
  reviewMultiplayerMoves,
  shownBoardPosition,
  shownEarlierPosition,
  shownReviewDescription,
} from '@libs/game-matchmaking-harness-ts/multiplayer-review';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameOf, turnGameOf } from './game-world';
import { victoryMoveAt } from './matched-game';
import { markReviewing } from './matched-game-review-world';
import { openOn } from './matched-game-shown.steps';

const AFTER_FIRST_MOVE = 'matched-game:position-after-first-move';

/**
 * The position the game was in after its first move, as both people's
 * boards held it then: the board the second move was made on.
 */
function positionAfterFirstMove(w: HarnessWorld): string {
  const kept = w.memo.get(AFTER_FIRST_MOVE);
  if (typeof kept === 'string') return kept;
  const board = boardBeforeMove(w);
  if (board?.revision !== 1)
    throw new Error('The scenario kept no board after the first move');
  w.memo.set(AFTER_FIRST_MOVE, board.fen);
  return board.fen;
}

/** What `person`'s own board shows: the moves to it, and its position. */
async function boardSeen(
  w: HarnessWorld,
  person: string,
  wanted: { readonly earlier: number | null; readonly position: string }
) {
  const device = viewerOf(w, person);
  await openOn(w, device);
  const shown = async () => ({
    earlier: await w.s.read(shownEarlierPosition, device),
    position: await w.s.read(shownBoardPosition, device),
  });
  await w.s.until(
    async (s) => ({
      earlier: await shownEarlierPosition(s, device),
      position: await shownBoardPosition(s, device),
    }),
    {
      pred: (seen) =>
        seen.earlier === wanted.earlier && seen.position === wanted.position,
    }
  );
  expect(await shown()).toEqual(wanted);
}

/** `person`'s board shows the earlier position after the first move. */
function afterFirstMoveSeen(w: HarnessWorld, person: string) {
  return boardSeen(w, person, {
    earlier: 1,
    position: positionAfterFirstMove(w),
  });
}

/** `person`'s board shows the game as it really stands. */
async function currentSeen(w: HarnessWorld, person: string, moves?: number) {
  const game = await matchedGameOf(w, pairOf(w)[0]);
  if (moves !== undefined) expect(game.revision).toBe(moves);
  await boardSeen(w, person, { earlier: null, position: game.fen });
}

async function review(
  w: HarnessWorld,
  person: string,
  step: MultiplayerReviewStep,
  keyboard = false
) {
  const device = viewerOf(w, person);
  await openOn(w, device);
  await w.s.apply(reviewMultiplayerMoves, device, step, keyboard);
  markReviewing(w, person, step !== 'current');
}

/** `person` chose the first move and their board shows the position after it. */
async function reviewingFirstMove(w: HarnessWorld, person: string) {
  positionAfterFirstMove(w);
  await review(w, person, 1);
  await afterFirstMoveSeen(w, person);
}

Given(
  '{actor} is reviewing the earlier position after the first move',
  reviewingFirstMove
);
Given(
  "{actor} was reviewing the earlier position after the first move when {actor}'s next move was accepted",
  async (w, person: string) => {
    await reviewingFirstMove(w, person);
    const { revision } = await matchedGameOf(w, pairOf(w)[0]);
    await acceptedMoves(w, [victoryMoveAt(w, revision)]);
    await afterFirstMoveSeen(w, person);
  }
);

When(
  "{actor} steps back one move in the move list with the keyboard's left arrow",
  (w, person: string) => review(w, person, 'back', true)
);
When(
  "{actor} steps forward one move in the move list with the keyboard's right arrow",
  (w, person: string) => review(w, person, 'forward', true)
);
When('{actor} goes to the start of the move list', (w, person: string) =>
  review(w, person, 'start')
);
When('{actor} returns to the current position', (w, person: string) =>
  review(w, person, 'current')
);

Then(
  "{actor}'s board (still )shows the earlier position after the first move",
  (w, person: string) => afterFirstMoveSeen(w, person)
);
Then(
  '{actor} hears she is reviewing the earlier position after the first move',
  async (w, person: string) => {
    const device = viewerOf(w, person);
    const move = turnGameOf(w).fixtures.firstSideVictoryLabels[0];
    if (move === undefined) throw new Error('The game names no first move');
    await openOn(w, device);
    expect(await w.s.read(shownReviewDescription, device)).toContain(
      `You are reviewing an earlier position, after 1. ${move}.`
    );
  }
);
Then(
  "{actor}'s board shows the earlier position at the start of the game",
  (w, person: string) =>
    boardSeen(w, person, {
      earlier: 0,
      position: gameOf(w).shared.registration.rules.initial(),
    })
);
Then(
  "{actor}'s board (still )shows the current position",
  (w, person: string) => currentSeen(w, person)
);
Then(
  "{actor}'s board shows the current position with {actor}'s next move",
  (w, person: string) => currentSeen(w, person, 3)
);
Then('{actor} cannot review an earlier position', (w, person: string) =>
  boardSeen(w, person, {
    earlier: null,
    position: gameOf(w).shared.registration.rules.initial(),
  })
);
Then("both people's boards still show the starting position", async (w) => {
  const start = gameOf(w).shared.registration.rules.initial();
  for (const person of pairOf(w))
    await boardSeen(w, person, { earlier: null, position: start });
});
Then(
  '{actor} is told she is reviewing an earlier position',
  async (w, person: string) => {
    const device = viewerOf(w, person);
    await openOn(w, device);
    expect(
      await w.s.read(shownMultiplayerText, device, 'multiplayer-reviewing')
    ).not.toBeNull();
    const board: MultiplayerBoardShown = await w.s.read(
      multiplayerBoardShown,
      device
    );
    expect(board.boardTakesMoves).toBe(false);
  }
);
