/**
 * What the chess puzzle models read of a person's view: the views as
 * chess's models name them, and the Puzzle Assistant's guidance beside the
 * move of the line examined and the help on show.
 */

import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import {
  readPuzzleView as readGamePuzzleView,
  readPuzzleProbe,
} from '@libs/game-session-harness-ts/puzzle-screen';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { readPuzzleAssistant } from './puzzle-assistant-ui';

/** The view as chess's models name it: the game's choices are chess's. */
export async function readPuzzleView(s: ProductHarness, actor: string) {
  const view = await readGamePuzzleView(s, actor, chessGameShared.id);
  return view === 'GameChoices' ? 'ChessChoices' : view;
}

export async function readPuzzleGuidance(s: ProductHarness, actor: string) {
  const onBoard = (await readPuzzleView(s, actor)) === 'Board';
  const probe = onBoard ? await readPuzzleProbe(s, actor) : null;
  const assistant = onBoard ? await readPuzzleAssistant(s, actor) : null;
  const wrongKinds = ['wrong', 'missed mate', 'hanging piece', 'knight fork'];
  const kind = assistant?.kind ?? 'none';
  return {
    position: probe?.solveIdx ?? 0,
    help: probe?.hintStage ?? 'none',
    guidance: wrongKinds.includes(kind) ? 'wrong' : kind,
  };
}
