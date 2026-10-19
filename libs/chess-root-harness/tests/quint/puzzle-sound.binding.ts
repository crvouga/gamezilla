/**
 * `specs/chess/puzzle-sound.qnt` on the product: a signed-in solver, the
 * app's sounds on or off, is on the en passant puzzle and plays its e5-d6
 * capture, which solves it. What she heard is what her device's audio
 * actually played since the puzzle was ready, by chess's own sounds. Every
 * other puzzle sound is every game's (`@libs/games-harness`).
 */

import {
  openPuzzleByTheme,
  playPuzzleMove,
} from '@libs/chess-puzzle-harness/chess-actions';
import { readPuzzleBoardSounds } from '@libs/chess-puzzle-harness/chess-board-audio';
import { ingestChessPuzzleCsv } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
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
const PUZZLE = NAMED_PUZZLES.enPassant;
/** How long a sound already due has to play. */
const SOUND_MS = 1_000;
/** Memo key: how many chess sounds were played before the capture. */
const HEARD_BEFORE = 'audio-start';

/** What each chess sound is to the model. */
const HEARD: Readonly<Record<string, string>> = {
  puzzleCheckmate: 'solved',
  promote: 'rating gain',
};

async function noteHeard(w: QuintHarnessWorld): Promise<void> {
  w.memo.set(
    HEARD_BEFORE,
    (await w.quiet.read(readPuzzleBoardSounds, ACTOR)).length
  );
}

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-sound',
  traces: 24,
  maxSteps: 12,
  verifySteps: 4,
  actions: {
    init: async (w, picks) => {
      await w.s.apply(signInWithGoogle, ACTOR);
      await w.s.apply(returnToTabs, ACTOR);
      await w.s.apply(configureSounds, ACTOR, picks['on'] === true);
      if (PUZZLE.csv !== null)
        await w.s.apply(ingestChessPuzzleCsv, PUZZLE.csv);
      await w.s.apply(createSpace, ACTOR);
      await w.s.apply(openGamePuzzles, ACTOR, CHESS_GAME_ID);
      await w.s.apply(openPuzzleByTheme, ACTOR, PUZZLE.theme, PUZZLE.id);
      await w.s.advanceTime(SOUND_MS);
      await noteHeard(w);
    },
    playCapturePuzzleMove: async (w) => {
      await noteHeard(w);
      await w.s.apply(playPuzzleMove, ACTOR, 'e5d6');
      await w.s.until((s) => isPuzzleSolved(s, ACTOR), { maxMs: 20_000 });
      await w.s.advanceTime(SOUND_MS);
    },
    _wait: (w) => w.s.advanceTime(SOUND_MS),
  },
  observe: async (w) => {
    const before = w.memo.get(HEARD_BEFORE);
    if (typeof before !== 'number') throw new Error('nothing heard noted');
    const played = await w.quiet.read(readPuzzleBoardSounds, ACTOR);
    const probe = await w.quiet.read(readPuzzleProbe, ACTOR);
    const onBoard = await w.quiet.read(readPuzzleOnBoard, ACTOR);
    return {
      puzzleSound: {
        kind: onBoard === PUZZLE.id ? 'capture puzzle' : 'unknown',
        move: probe?.solveIdx ?? -1,
        soundsOn: await w.quiet.read(readSoundsOn, ACTOR),
        heard: new Set(played.slice(before).map((name) => HEARD[name] ?? name)),
      },
    };
  },
});
