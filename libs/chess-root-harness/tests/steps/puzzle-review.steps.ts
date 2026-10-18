/**
 * Reviewing a played chess puzzle's line from the game log, its moves as
 * chess writes them. Stepping through a review is every game's.
 */

import { expect } from 'bun:test';
import { readLocalPuzzleRow } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import {
  openPuzzleReviewFromLog,
  readPuzzleReviewMoves,
} from '@libs/game-session-harness/puzzle-records';
import { Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { remember } from '@libs/harness/spec-world';
import { currentPuzzle, ensureStatsOpen, required } from './puzzle-world';

const reviewedKey = (actor: Actor) => `reviewedLine:${actor}`;

/** Open the current puzzle's review from the game log. */
async function openReview(w: HarnessWorld, actor: Actor): Promise<void> {
  const puzzle = currentPuzzle(w, actor);
  const row = required(
    await w.s.read(readLocalPuzzleRow, actor, puzzle),
    `${actor}'s copy of puzzle ${puzzle}`
  );
  remember(w, reviewedKey(actor), row);
  await ensureStatsOpen(w, actor);
  await w.s.apply(openPuzzleReviewFromLog, actor, puzzle);
}

When(
  "{actor} opens the puzzle's review from their game log",
  async (w, actor: Actor) => {
    await openReview(w, actor);
  }
);

Then(
  "{actor}'s review lists the moves {string}",
  async (w, actor: Actor, moves: string) => {
    expect(await w.s.read(readPuzzleReviewMoves, actor)).toEqual(
      moves.split(',').map((move) => move.trim())
    );
  }
);
