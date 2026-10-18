import {
  openPuzzleByTheme,
  playPuzzleMove,
  playUntilSolved,
} from '@libs/chess-puzzle-harness/chess-actions';
import { readPuzzleBoardSounds } from '@libs/chess-puzzle-harness/chess-board-audio';
import { ingestChessPuzzleCsv } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { readRenderedPuzzleReviewBoard } from '@libs/chess-puzzle-harness/chess-puzzle-review-ui';
import { readPuzzleBoardProbe } from '@libs/chess-puzzle-harness/chess-puzzle-solve-ui';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import {
  chooseReviewMove,
  openPuzzleReviewFromLog,
  readPuzzleReview,
  showGamePuzzleStats,
  useReviewControl,
} from '@libs/game-session-harness/puzzle-records';
import {
  isPuzzleSolved,
  openGamePuzzles,
  readPuzzleOnBoard,
  readPuzzleProbe,
} from '@libs/game-session-harness/puzzle-screen';
import { returnToTabs, signInWithGoogle } from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { configureSounds, readSoundsOn } from '@libs/harness/sounds-preference';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const ACTOR = 'alice';
async function boundary(w: QuintHarnessWorld) {
  w.memo.set(
    'audio-start',
    (await w.quiet.read(readPuzzleBoardSounds, ACTOR)).length
  );
}
async function prepare(w: QuintHarnessWorld, kind: string, on: boolean) {
  await w.s.apply(signInWithGoogle, ACTOR);
  await w.s.apply(returnToTabs, ACTOR);
  await w.s.apply(configureSounds, ACTOR, on);
  const puzzle =
    kind === 'quiet puzzle'
      ? NAMED_PUZZLES.twoRookClearance
      : kind === 'capture puzzle'
        ? NAMED_PUZZLES.enPassant
        : NAMED_PUZZLES.fourMoveMateInTwo;
  if (puzzle.csv !== null) await w.s.apply(ingestChessPuzzleCsv, puzzle.csv);
  await w.s.apply(createSpace, ACTOR);
  await w.s.apply(openGamePuzzles, ACTOR, CHESS_GAME_ID);
  await w.s.apply(openPuzzleByTheme, ACTOR, puzzle.theme, puzzle.id);
  if (kind === 'review') {
    await w.s.apply(playUntilSolved, ACTOR);
    await w.s.apply(showGamePuzzleStats, ACTOR, CHESS_GAME_ID);
    await w.s.apply(openPuzzleReviewFromLog, ACTOR, puzzle.id);
    await w.s.apply(chooseReviewMove, ACTOR, 3);
    await w.s.read(readRenderedPuzzleReviewBoard, ACTOR);
  }
  await w.s.advanceTime(1000);
  await boundary(w);
  w.memo.set('audio-init', w.memo.get('audio-start'));
}
async function observed(w: QuintHarnessWorld) {
  const review = await w.quiet.read(readPuzzleReview, ACTOR);
  const id = await w.quiet.read(readPuzzleOnBoard, ACTOR);
  const kind =
    review !== null
      ? 'review'
      : id === NAMED_PUZZLES.twoRookClearance.id
        ? 'quiet puzzle'
        : id === NAMED_PUZZLES.enPassant.id
          ? 'capture puzzle'
          : 'unknown';
  const debug =
    review === null ? await w.quiet.read(readPuzzleProbe, ACTOR) : null;
  const start = w.memo.get('audio-start');
  if (typeof start !== 'number') throw new Error('No actual audio boundary');
  const names = await w.quiet.read(readPuzzleBoardSounds, ACTOR);
  const labels: Readonly<Record<string, string>> = {
    puzzleCorrectMove: 'correct move',
    puzzleCheckmate: 'solved',
    promote: 'rating gain',
    gameEnd: 'end',
  };
  return {
    puzzleSound: {
      kind,
      move: review?.move ?? debug?.solveIdx ?? -1,
      soundsOn: await w.quiet.read(readSoundsOn, ACTOR),
      heard: new Set(names.slice(start).map((name) => labels[name] ?? name)),
    },
  };
}
bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-sound',
  traces: 24,
  maxSteps: 12,
  verifySteps: 4,
  actions: {
    init: (w, p) => prepare(w, String(p['kind']), p['on'] as boolean),
    playQuietPuzzleMove: async (w) => {
      await boundary(w);
      await w.s.apply(playPuzzleMove, ACTOR, 'a1a5');
      await w.s.until((s) => readPuzzleProbe(s, ACTOR), {
        maxMs: 20_000,
        pred: (value) => value?.solveIdx === 3,
      });
      await w.s.advanceTime(1000);
    },
    playCapturePuzzleMove: async (w) => {
      await boundary(w);
      await w.s.apply(playPuzzleMove, ACTOR, 'e5d6');
      await w.s.until((s) => isPuzzleSolved(s, ACTOR), { maxMs: 20_000 });
      await w.s.advanceTime(1000);
    },
    stepPuzzleSoundReview: async (w) => {
      await boundary(w);
      await w.s.apply(useReviewControl, ACTOR, 'forward');
      await w.s.advanceTime(1000);
    },
    configurePuzzleSounds: async (w, p) => {
      await boundary(w);
      await w.s.apply(configureSounds, ACTOR, p['on'] as boolean);
      await w.s.advanceTime(1000);
    },
  },
  observe: observed,
  fingerprint: async (w) => {
    const review = await w.quiet.read(readPuzzleReview, ACTOR);
    const board =
      review === null
        ? await w.quiet.read(readPuzzleBoardProbe, ACTOR)
        : await w.quiet.read(readRenderedPuzzleReviewBoard, ACTOR);
    const start = w.memo.get('audio-init');
    if (typeof start !== 'number') throw new Error('No initial audio boundary');
    return JSON.stringify({
      state: {
        ...(await observed(w)).puzzleSound,
        heard: [...(await observed(w)).puzzleSound.heard],
      },
      board,
      played: (await w.quiet.read(readPuzzleBoardSounds, ACTOR)).slice(start),
    });
  },
});
