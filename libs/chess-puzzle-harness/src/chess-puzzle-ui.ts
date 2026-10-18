/**
 * Chess's own gestures on the platform's puzzle board: its board's
 * readiness (the chess board measures itself before it takes a drag),
 * solving by the line's next move as the board names it, a wrong move
 * found among the legal moves of the position shown, and a watcher's drag.
 * Everything else about the puzzle screens is every game's
 * (`@libs/game-session-harness/puzzle-screen`).
 */

import {
  isPuzzleSolved,
  readPuzzleBoardPosition,
  readPuzzleProbe,
  waitPuzzleState,
} from '@libs/game-session-harness/puzzle-screen';
import { actorUi, pollUntil } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import { Chess } from 'chess.js';

const WAIT_MS = 15_000;
const INTERACTIVE_MS = 2_500;
const POLL_MS = 250;

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/​/g, '').trim();
}

function puzzleBoard(
  s: ProductHarness,
  actorId: string
): Promise<ChessBoardFlows> {
  return actorUi(s, actorId).then(
    (ui) => new ChessBoardFlows(ui, Handles.chessPuzzleBoard)
  );
}

function parseUciSquares(uci: string): { from: Square; to: Square } {
  const t = uci.trim().toLowerCase();
  if (t.length < 4) {
    throw new Error(`invalid uci: ${uci}`);
  }
  return { from: t.slice(0, 2) as Square, to: t.slice(2, 4) as Square };
}

async function waitUntilInteractiveOrSolved(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  try {
    await pollUntil(
      s,
      async () => {
        if (await isPuzzleSolved(s, actorId)) return true;
        return (await readPuzzleProbe(s, actorId))?.interactive === true
          ? true
          : null;
      },
      {
        maxMs: INTERACTIVE_MS,
        stepMs: POLL_MS,
        description: 'puzzle interactive or solved',
      }
    );
  } catch {
    // Spectators never become interactive — proceed either way.
  }
}

/** The chess board is up, measured and, for the solver, taking moves. */
export async function expectPlayReady(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzlePlayScreen).expect.visible({
    timeoutMs: WAIT_MS,
  });
  await waitBoardReady(s, actorId);
  await waitUntilInteractiveOrSolved(s, actorId);
}

/**
 * The board frame has a measurable box. happy-dom reports 0×0, so
 * {@link PuzzleBoardFrame} stays gated until `layout()` installs one.
 * False while the frame is still gated or absent.
 */
async function boardReadyNow(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  const boardNode = ui.get(Handles.chessPuzzleBoard);
  if (!(await frame.isVisible())) return false;
  await frame.layout();
  if (!(await boardNode.isVisible())) return false;
  await boardNode.layout();
  try {
    const probe = await (await puzzleBoard(s, actorId)).readProbe();
    return probe.size > 0;
  } catch {
    return false;
  }
}

async function waitBoardReady(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await boardReadyNow(s, actorId)) ? true : null),
    { maxMs: WAIT_MS, description: 'chess-puzzle-board ready' }
  );
}

async function waitExpectedUci(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  const ui = await actorUi(s, actorId);
  const node = ui.get(Handles.chessPuzzleExpectedUci);
  await node.wait('visible', { timeoutMs: WAIT_MS });
  return pollUntil(
    s,
    async () => {
      if (await isPuzzleSolved(s, actorId)) {
        throw new Error('expected UCI but puzzle already solved');
      }
      const uci = stripProbe(await node.text()).toLowerCase();
      return uci.length >= 4 ? uci : null;
    },
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'expected uci' }
  );
}

async function waitAfterHumanMove(
  s: ProductHarness,
  actorId: string,
  playedUci: string
): Promise<void> {
  const played = playedUci.trim().toLowerCase();
  const ui = await actorUi(s, actorId);
  const node = ui.get(Handles.chessPuzzleExpectedUci);
  try {
    await pollUntil(
      s,
      async () => {
        if (await isPuzzleSolved(s, actorId)) return true;
        const uci = stripProbe(await node.text()).toLowerCase();
        return uci.length >= 4 && uci !== played ? true : null;
      },
      { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'next expected uci' }
    );
  } catch {
    // Best effort — the caller's next assertion reports the truth.
  }
}

async function playExpectedMove(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const uci = await waitExpectedUci(s, actorId);
  const squares = parseUciSquares(uci);
  await waitBoardReady(s, actorId);
  const board = await puzzleBoard(s, actorId);
  await board.drag(squares.from, squares.to);
  await waitAfterHumanMove(s, actorId, uci);
}

/** Drag the line's next move as the board names it, until solved. */
export async function solvePuzzle(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const maxMoves = 16;
  for (let i = 0; i < maxMoves; i += 1) {
    if (await isPuzzleSolved(s, actorId)) break;
    await playExpectedMove(s, actorId);
  }
  await waitPuzzleState(s, actorId, 'solved');
}

/** A spectator drags a legal move; the room records it as a suggestion. */
export async function suggestPuzzleMove(
  s: ProductHarness,
  actorId: string,
  from: Square,
  to: Square
): Promise<void> {
  await waitBoardReady(s, actorId);
  const board = await puzzleBoard(s, actorId);
  await board.drag(from, to);
}

/** The position on the board, waiting for the first paint. */
async function readDisplayFen(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  return pollUntil(s, () => readPuzzleBoardPosition(s, actorId), {
    maxMs: WAIT_MS,
    stepMs: POLL_MS,
    description: 'display fen',
  });
}

/** A legal move for the side to move that is not the expected solution ply. */
export function pickWrongUci(fen: string, expectedUci: string): string {
  const chess = new Chess(fen);
  const expected = expectedUci.trim().toLowerCase();
  const legal = chess
    .moves({ verbose: true })
    .map((m) => `${m.from}${m.to}${m.promotion ?? ''}`)
    .filter((uci) => uci.slice(0, 4) !== expected.slice(0, 4))
    .sort();
  const pick = legal[0];
  if (pick === undefined) {
    throw new Error(`no legal wrong move in ${fen}`);
  }
  return pick;
}

/** Drag a legal-but-wrong move; the room flips the attempt to `wrong`. */
export async function playWrongMove(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const expected = await waitExpectedUci(s, actorId);
  const fen = await readDisplayFen(s, actorId);
  const wrong = pickWrongUci(fen, expected);
  const squares = parseUciSquares(wrong);
  const board = await puzzleBoard(s, actorId);
  await board.drag(squares.from, squares.to);
  await waitPuzzleState(s, actorId, 'wrong');
}
