/**
 * `specs/games/puzzle-sound.qnt` on the product, for each conformance game
 * offering puzzles: a signed-in solver, the app's sounds on or off, is
 * solving the game's known puzzle (alone in the pool) at its first move, or
 * reviewing it solved at move 3. What she heard is what her device's audio
 * actually played since the last action, each sound as the game names it
 * (`HarnessGame.puzzleSounds`); a capture, check or castling is a move.
 */

import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import {
  playNextKnownMove,
  solveKnownPuzzle,
  theKnownPuzzle,
} from '@libs/game-session-harness/puzzle-moves';
import { writeKnownPuzzlePool } from '@libs/game-session-harness/puzzle-pool';
import {
  chooseReviewMove,
  openPuzzleReviewFromLog,
  readPuzzleReview,
  showGamePuzzleStats,
  useReviewControl,
} from '@libs/game-session-harness/puzzle-records';
import {
  openGamePuzzles,
  readPuzzleProbe,
} from '@libs/game-session-harness/puzzle-screen';
import { readPuzzleSoundsPlayed } from '@libs/game-session-harness/puzzle-sounds';
import { returnToTabs, signInWithGoogle } from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { configureSounds, readSoundsOn } from '@libs/harness/sounds-preference';
import { createSpace } from '@libs/spaces-harness/space-actions';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { conformanceGameOf } from '../conformance-world';

const SOLVER = 'alice';
/** The review is opened at this move, before the line's last. */
const REVIEW_MOVE = 3;
/** How long a sound already due has to play. */
const SOUND_MS = 1_000;
/** Memo key: how many puzzle sounds were played before the last action. */
const HEARD_BEFORE = 'puzzle-sounds-before';

function gameOfTrace(w: QuintHarnessWorld): HarnessGame {
  return conformanceGameOf(w.ctx.variant, w.ctx.title);
}

function gameId(w: QuintHarnessWorld): string {
  return gameOfTrace(w).shared.id;
}

/** Note what has been heard so far: the next action is heard from here. */
async function noteHeard(w: QuintHarnessWorld): Promise<void> {
  w.memo.set(
    HEARD_BEFORE,
    (await w.quiet.read(readPuzzleSoundsPlayed, SOLVER, gameId(w))).length
  );
}

/** Act, let any sound it set off play, and hear only what followed. */
function heard(
  act: (w: QuintHarnessWorld, picks: Picks) => Promise<void>
): (w: QuintHarnessWorld, picks: Picks) => Promise<void> {
  return async (w, picks) => {
    await noteHeard(w);
    await act(w, picks);
    await w.s.advanceTime(SOUND_MS);
  };
}

async function prepare(
  w: QuintHarnessWorld,
  kind: string,
  on: boolean
): Promise<void> {
  const known = theKnownPuzzle(gameOfTrace(w)).record.id;
  await w.s.apply(signInWithGoogle, SOLVER);
  await w.s.apply(returnToTabs, SOLVER);
  await w.s.apply(configureSounds, SOLVER, on);
  await w.s.apply(writeKnownPuzzlePool, gameId(w), [{ id: known }]);
  await w.s.apply(createSpace, SOLVER);
  await w.s.apply(openGamePuzzles, SOLVER, gameId(w));
  if (kind === 'review') {
    await w.s.apply(solveKnownPuzzle, SOLVER, gameId(w));
    await w.s.apply(showGamePuzzleStats, SOLVER, gameId(w));
    await w.s.apply(openPuzzleReviewFromLog, SOLVER, known);
    await w.s.apply(chooseReviewMove, SOLVER, REVIEW_MOVE);
  }
  await w.s.advanceTime(SOUND_MS);
  await noteHeard(w);
}

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-sound',
  traces: 24,
  maxSteps: 12,
  verifySteps: 4,
  actions: {
    init: (w, picks) => prepare(w, String(picks['kind']), picks['on'] === true),
    playPuzzleMove: heard((w) =>
      w.s.apply(playNextKnownMove, SOLVER, gameId(w))
    ),
    stepPuzzleSoundReview: heard((w) =>
      w.s.apply(useReviewControl, SOLVER, 'forward')
    ),
    configurePuzzleSounds: heard((w, picks) =>
      w.s.apply(configureSounds, SOLVER, picks['on'] === true)
    ),
  },
  observe: async (w) => {
    const review = await w.quiet.read(readPuzzleReview, SOLVER);
    const probe =
      review === null ? await w.quiet.read(readPuzzleProbe, SOLVER) : null;
    const before = w.memo.get(HEARD_BEFORE);
    if (typeof before !== 'number') throw new Error('nothing heard noted');
    const played = await w.quiet.read(
      readPuzzleSoundsPlayed,
      SOLVER,
      gameId(w)
    );
    return {
      puzzleSound: {
        kind: review === null ? 'puzzle' : 'review',
        move: review?.move ?? probe?.solveIdx ?? -1,
        soundsOn: await w.quiet.read(readSoundsOn, SOLVER),
        heard: new Set(played.slice(before)),
      },
    };
  },
});
