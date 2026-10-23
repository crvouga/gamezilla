/**
 * Solve-flow stimuli and reads (§5 / §6 / §3): board probe, arbitrary move
 * input, the promotion picker, "Show solution", haptics, and an app restart
 * that keeps the device.
 */

import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared-ts/flows';
import type { ChessBoardProbe } from '@pkgs/chess-board-core-shared-ts/probe';
import {
  chessBoardLayerTestId,
  chessBoardPromotionTestId,
  parseChessBoardPaint,
} from '@pkgs/chess-board-core-shared-ts/probe';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { Chess } from 'chess.js';

const WAIT_MS = 15_000;

function squaresOf(uci: string): { from: Square; to: Square } {
  const t = uci.trim().toLowerCase();
  if (t.length < 4) throw new Error(`invalid uci: ${uci}`);
  return { from: t.slice(0, 2) as Square, to: t.slice(2, 4) as Square };
}

async function puzzleBoard(
  s: ProductHarness,
  actorId: string
): Promise<ChessBoardFlows> {
  const ui = await actorUi(s, actorId);
  return new ChessBoardFlows(ui, Handles.chessPuzzleBoard);
}

/** What the puzzle board renders right now (FEN, orientation, picker, …). */
export async function readPuzzleBoardProbe(
  s: ProductHarness,
  actorId: string
): Promise<ChessBoardProbe | null> {
  try {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.chessPuzzleBoardFrame).layout();
    await ui.get(Handles.chessPuzzleBoard).layout();
    return await (await puzzleBoard(s, actorId)).readProbe();
  } catch {
    return null;
  }
}

/** The position on the board, or `null` before the first paint. */
export async function readPuzzleBoardFen(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return (await readPuzzleBoardProbe(s, actorId))?.fen ?? null;
}

/** The piece on `square` of the puzzle board (`wp`, `bk`, …), or null. */
export async function readPuzzleBoardPieceAt(
  s: ProductHarness,
  actorId: string,
  square: Square
): Promise<string | null> {
  const fen = await readPuzzleBoardFen(s, actorId);
  if (fen === null) return null;
  const piece = new Chess(fen).get(square);
  return piece ? `${piece.color}${piece.type}` : null;
}

/** True while the board accepts solver input (unlocked, solver to move). */
export async function isPuzzleBoardInteractive(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return (await readPuzzleBoardProbe(s, actorId))?.interactive ?? false;
}

/** Board orientation as painted (`white` faces White at the bottom). */
export async function readPuzzleBoardOrientationProbe(
  s: ProductHarness,
  actorId: string
): Promise<'white' | 'black' | null> {
  return (await readPuzzleBoardProbe(s, actorId))?.orientation ?? null;
}

/** Drag `uci`'s from → to square (promotion resolves through the picker). */
export async function dragPuzzleUci(
  s: ProductHarness,
  actorId: string,
  uci: string
): Promise<void> {
  const squares = squaresOf(uci);
  const board = await puzzleBoard(s, actorId);
  await board.drag(squares.from, squares.to);
}

/** Tap `from`, then `to` (the no-drag input path). */
export async function tapPuzzleUci(
  s: ProductHarness,
  actorId: string,
  uci: string
): Promise<void> {
  const squares = squaresOf(uci);
  const board = await puzzleBoard(s, actorId);
  await board.tapSquare(squares.from);
  await board.tapSquare(squares.to);
}

/** Pick up the piece on `square` (tap it) without moving it. */
export async function pickUpPuzzlePieceAt(
  s: ProductHarness,
  actorId: string,
  square: Square
): Promise<void> {
  const board = await puzzleBoard(s, actorId);
  await board.tapSquare(square);
}

/**
 * The squares the board marks as where the picked-up piece can go (a dot on
 * an empty square, a ring on a capture), sorted.
 */
export async function readPuzzleBoardDestinations(
  s: ProductHarness,
  actorId: string
): Promise<readonly Square[]> {
  const ui = await actorUi(s, actorId);
  const layer = ui.get(
    chessBoardLayerTestId(Handles.chessPuzzleBoard, 'squares')
  );
  const paint = parseChessBoardPaint(await layer.text());
  return paint
    .flatMap((token) => {
      const match = /^(?:dot|ring)@([a-h][1-8])$/.exec(token);
      return match?.[1] === undefined ? [] : [match[1] as Square];
    })
    .sort();
}

/** The promotion picker's pending move, or null when it is closed. */
export async function readPuzzlePromotionPending(
  s: ProductHarness,
  actorId: string
): Promise<{ from: string; to: string; color: 'w' | 'b' } | null> {
  const probe = await readPuzzleBoardProbe(s, actorId);
  return probe?.promotion ?? null;
}

/** Choose a promotion piece from the picker (`q` / `r` / `b` / `n`). */
export async function pickPuzzlePromotion(
  s: ProductHarness,
  actorId: string,
  piece: 'q' | 'r' | 'b' | 'n'
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(chessBoardPromotionTestId(Handles.chessPuzzleBoard, piece))
    .tap({ timeoutMs: WAIT_MS });
}
