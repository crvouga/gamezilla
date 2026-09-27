/**
 * Solve-flow stimuli and reads (§5 / §6 / §3): board probe, arbitrary move
 * input, the promotion picker, "Show solution", the restored-attempt reads
 * (interaction log, haptics) and an app restart that keeps the device.
 */

import { actorUi, pollUntil } from '@libs/sim-harness/system/actor-ui';
import { actorLocalSql } from '@libs/sim-harness/system/identity';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';
import { ChessBoardFlows } from '@pkgs/chess-board-core/flows';
import {
  type ChessBoardProbe,
  chessBoardLayerTestId,
  chessBoardPromotionTestId,
  parseChessBoardPaint,
} from '@pkgs/chess-board-core/probe';
import type { Square } from '@pkgs/chess-board-core/types';
import type { RecordingHaptics } from '@pkgs/device/haptics';
import { sql } from '@pkgs/sql';
import { Chess } from 'chess.js';
import { readPuzzleStatus } from './chess-puzzle-ui';

const WAIT_MS = 15_000;
const POLL_MS = 100;

function squaresOf(uci: string): { from: Square; to: Square } {
  const t = uci.trim().toLowerCase();
  if (t.length < 4) throw new Error(`invalid uci: ${uci}`);
  return { from: t.slice(0, 2) as Square, to: t.slice(2, 4) as Square };
}

async function puzzleBoard(
  s: ProductSim,
  actorId: string
): Promise<ChessBoardFlows> {
  const ui = await actorUi(s, actorId);
  return new ChessBoardFlows(ui, Handles.chessPuzzleBoard);
}

/** What the puzzle board renders right now (FEN, orientation, picker, …). */
export async function readPuzzleBoardProbe(
  s: ProductSim,
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
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  return (await readPuzzleBoardProbe(s, actorId))?.fen ?? null;
}

/** The piece on `square` of the puzzle board (`wp`, `bk`, …), or null. */
export async function readPuzzleBoardPieceAt(
  s: ProductSim,
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
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  return (await readPuzzleBoardProbe(s, actorId))?.interactive ?? false;
}

/** Board orientation as painted (`white` faces White at the bottom). */
export async function readPuzzleBoardOrientationProbe(
  s: ProductSim,
  actorId: string
): Promise<'white' | 'black' | null> {
  return (await readPuzzleBoardProbe(s, actorId))?.orientation ?? null;
}

/** Drag `uci`'s from → to square (promotion resolves through the picker). */
export async function dragPuzzleUci(
  s: ProductSim,
  actorId: string,
  uci: string
): Promise<void> {
  const squares = squaresOf(uci);
  const board = await puzzleBoard(s, actorId);
  await board.drag(squares.from, squares.to);
}

/** Tap `from`, then `to` (the no-drag input path). */
export async function tapPuzzleUci(
  s: ProductSim,
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
  s: ProductSim,
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
  s: ProductSim,
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
  s: ProductSim,
  actorId: string
): Promise<{ from: string; to: string; color: 'w' | 'b' } | null> {
  const probe = await readPuzzleBoardProbe(s, actorId);
  return probe?.promotion ?? null;
}

/** Choose a promotion piece from the picker (`q` / `r` / `b` / `n`). */
export async function pickPuzzlePromotion(
  s: ProductSim,
  actorId: string,
  piece: 'q' | 'r' | 'b' | 'n'
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(chessBoardPromotionTestId(Handles.chessPuzzleBoard, piece))
    .tap({ timeoutMs: WAIT_MS });
}

/** §6: play the remaining line out, then review (`revealed`). */
export async function showPuzzleSolution(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  // While solving, the one hint button escalates Hint → Solution → line; after
  // a wrong move the bar has its own Solution action.
  const solution = ui.get(Handles.chessPuzzleActionSolution);
  if (await solution.isVisible()) {
    await solution.tap({ timeoutMs: WAIT_MS });
  } else {
    const hint = ui.get(Handles.chessPuzzleActionHint);
    await hint.tap({ timeoutMs: WAIT_MS });
    await hint.tap({ timeoutMs: WAIT_MS });
    await hint.tap({ timeoutMs: WAIT_MS });
  }
  await pollUntil(
    s,
    async () =>
      (await readPuzzleStatus(s, actorId)) === 'revealed' ? true : null,
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'solution shown' }
  );
}

/** The §5 prompt in the puzzle header ("Your turn — …"). */
export async function readPuzzlePrompt(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    const text = await ui.get(Handles.chessPuzzleStatusLabel).text();
    return (text ?? '').replace(/​/g, '').trim();
  } catch {
    return null;
  }
}

export type PuzzleInteractionRowView = {
  readonly kind: string;
  readonly uci: string | null;
  readonly correct: number | null;
};

/** This actor's local interaction log for one puzzle, oldest first. */
export async function readPuzzleInteractions(
  s: ProductSim,
  actorId: string,
  puzzleId: string
): Promise<PuzzleInteractionRowView[]> {
  const db = actorLocalSql(s, actorId);
  if (db === null) return [];
  return db.query(sql<PuzzleInteractionRowView>`
    SELECT kind, uci, correct
    FROM chess_puzzle_interactions
    WHERE puzzle_id = ${puzzleId} AND deleted_at IS NULL
    ORDER BY at ASC, kind ASC
  `);
}

/** Outcome rows (`solved` / `failed` / `abandoned`) recorded for a puzzle. */
export async function readPuzzleOutcomes(
  s: ProductSim,
  actorId: string,
  puzzleId: string
): Promise<string[]> {
  const rows = await readPuzzleInteractions(s, actorId, puzzleId);
  return rows
    .map((row) => row.kind)
    .filter(
      (kind) => kind === 'solved' || kind === 'failed' || kind === 'abandoned'
    );
}

/** How many `started` rows this actor logged for a puzzle. */
export async function countPuzzleStarts(
  s: ProductSim,
  actorId: string,
  puzzleId: string
): Promise<number> {
  const rows = await readPuzzleInteractions(s, actorId, puzzleId);
  return rows.filter((row) => row.kind === 'started').length;
}

/** Haptic calls the actor's device recorded, in order. */
export async function readPuzzleHaptics(
  s: ProductSim,
  actorId: string
): Promise<readonly string[]> {
  const env = await s.sim.client(actorId);
  const haptics = env.haptics as RecordingHaptics;
  return [...haptics.calls];
}
