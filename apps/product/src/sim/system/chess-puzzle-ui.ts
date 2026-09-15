import { Handles } from '@libs/test-ids';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import { ChessBoardFlows } from '@pkgs/chess-board-core/flows';
import { Chess } from 'chess.js';

import { actorUi, pollUntil } from './actor-ui';
import type { ProductSim } from './sim';
import { waitActiveSpace } from './space-ui';

const WAIT_MS = 15_000;
const INTERACTIVE_MS = 2_500;
const POLL_MS = 250;

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/\u200b/g, '').trim();
}

function puzzleBoard(s: ProductSim, actorId: string): Promise<ChessBoardFlows> {
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

export async function isPuzzleSolved(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.chessPuzzleSummary).isVisible()) return true;
  try {
    const debug = stripProbe(await ui.get(Handles.chessPuzzleE2eDebug).text());
    return debug.startsWith('solved|');
  } catch {
    return false;
  }
}

async function readE2eField(
  s: ProductSim,
  actorId: string,
  index: number
): Promise<string | undefined> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessPuzzleE2eDebug).text());
    return raw.split('|')[index];
  } catch {
    return undefined;
  }
}

async function waitUntilInteractiveOrSolved(
  s: ProductSim,
  actorId: string
): Promise<void> {
  try {
    await pollUntil(
      s,
      async () => {
        if (await isPuzzleSolved(s, actorId)) return true;
        return (await readE2eField(s, actorId, 1)) === '1' ? true : null;
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

export async function expectPlayReady(
  s: ProductSim,
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
 * Synthesize layout on the board frame (and board once mounted). happy-dom
 * reports 0×0 rects, so {@link ChessPuzzleBoardFrame} stays gated on size=0
 * until `layout()` installs a measurable box and fires the layout event.
 */
async function waitBoardReady(s: ProductSim, actorId: string): Promise<void> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  const boardNode = ui.get(Handles.chessPuzzleBoard);
  const board = await puzzleBoard(s, actorId);
  await pollUntil(
    s,
    async () => {
      await frame.layout();
      if (!(await boardNode.isVisible())) return null;
      await boardNode.layout();
      try {
        const probe = await board.readProbe();
        return probe.size > 0 ? true : null;
      } catch {
        return null;
      }
    },
    { maxMs: WAIT_MS, description: 'chess-puzzle-board ready' }
  );
}

export async function openPuzzlePlay(
  s: ProductSim,
  actorId: string
): Promise<void> {
  await waitActiveSpace(s, actorId);
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.gameMenuChess).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(Handles.gameMenuChess).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).tap({ timeoutMs: WAIT_MS });
  await expectPlayReady(s, actorId);
}

async function waitExpectedUci(
  s: ProductSim,
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
  s: ProductSim,
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

async function playExpectedMove(s: ProductSim, actorId: string): Promise<void> {
  const uci = await waitExpectedUci(s, actorId);
  const squares = parseUciSquares(uci);
  const board = await puzzleBoard(s, actorId);
  await board.drag(squares.from, squares.to);
  await waitAfterHumanMove(s, actorId, uci);
}

export async function solvePuzzle(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const maxMoves = 16;
  for (let i = 0; i < maxMoves; i += 1) {
    if (await isPuzzleSolved(s, actorId)) {
      await waitPuzzleSolved(s, actorId);
      return;
    }
    await playExpectedMove(s, actorId);
  }
  await waitPuzzleSolved(s, actorId);
}

export async function waitPuzzleSolved(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleSummary).expect.visible({
    timeoutMs: WAIT_MS,
  });
}

async function readPickStatusField(
  s: ProductSim,
  actorId: string,
  key: string
): Promise<string | undefined> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessPuzzlePickStatus).text());
    for (const token of raw.split(/\s+/)) {
      if (token.startsWith(`${key}=`)) return token.slice(key.length + 1);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function readActivePuzzleId(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const value = await readPickStatusField(s, actorId, 'active');
  if (value === undefined || value === 'null' || value.length === 0) {
    return null;
  }
  return value;
}

export async function pressPuzzleNext(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleActionNext).tap({ timeoutMs: WAIT_MS });
}

/**
 * Wait until pick-status reports a non-null active id with loading cleared.
 * Does not assert difference — that is the standing property's job.
 */
export async function settleAfterPuzzleNext(
  s: ProductSim,
  actorId: string
): Promise<void> {
  await pollUntil(
    s,
    async () => {
      const active = await readActivePuzzleId(s, actorId);
      if (active === null) return null;
      const loading = await readPickStatusField(s, actorId, 'loading');
      return loading === '0' ? true : null;
    },
    {
      maxMs: WAIT_MS,
      stepMs: POLL_MS,
      description: 'puzzle pick settled after Next',
    }
  );
  await expectPlayReady(s, actorId);
}

/** `status|interactive|solveIdx|moves|solution|hintStage` probe → parsed. */
export type PuzzleE2eDebug = {
  readonly status: string;
  readonly interactive: boolean;
  readonly solveIdx: number;
  readonly moves: string;
  readonly solutionUci: string;
  readonly hintStage: string;
};

export async function readPuzzleDebug(
  s: ProductSim,
  actorId: string
): Promise<PuzzleE2eDebug | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessPuzzleE2eDebug).text());
    const parts = raw.split('|');
    if (parts.length < 6) return null;
    return {
      status: parts[0] ?? '',
      interactive: parts[1] === '1',
      solveIdx: Number.parseInt(parts[2] ?? '0', 10),
      moves: parts[3] ?? '',
      solutionUci: parts[4] ?? '',
      hintStage: parts[5] ?? '',
    };
  } catch {
    return null;
  }
}

export async function readPuzzleStatus(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const debug = await readPuzzleDebug(s, actorId);
  return debug?.status ?? null;
}

export async function readPuzzleHintStage(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const debug = await readPuzzleDebug(s, actorId);
  return debug?.hintStage ?? null;
}

export async function waitPuzzleStatus(
  s: ProductSim,
  actorId: string,
  status: string
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await readPuzzleStatus(s, actorId)) === status ? true : null),
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: `puzzle status ${status}` }
  );
}

export async function waitPuzzleHintStage(
  s: ProductSim,
  actorId: string,
  stage: string
): Promise<void> {
  await pollUntil(
    s,
    async () =>
      (await readPuzzleHintStage(s, actorId)) === stage ? true : null,
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: `hint stage ${stage}` }
  );
}

async function readDisplayFen(s: ProductSim, actorId: string): Promise<string> {
  const ui = await actorUi(s, actorId);
  return pollUntil(
    s,
    async () => {
      const fen = stripProbe(await ui.get(Handles.chessPuzzleE2eFen).text());
      return fen.length > 0 ? fen : null;
    },
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'display fen' }
  );
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
  s: ProductSim,
  actorId: string
): Promise<void> {
  const expected = await waitExpectedUci(s, actorId);
  const fen = await readDisplayFen(s, actorId);
  const wrong = pickWrongUci(fen, expected);
  const squares = parseUciSquares(wrong);
  const board = await puzzleBoard(s, actorId);
  await board.drag(squares.from, squares.to);
  await waitPuzzleStatus(s, actorId, 'wrong');
}

async function tapAction(
  s: ProductSim,
  actorId: string,
  handle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(handle).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(handle).tap({ timeoutMs: WAIT_MS });
}

export async function pressPuzzleRetry(
  s: ProductSim,
  actorId: string
): Promise<void> {
  await tapAction(s, actorId, Handles.chessPuzzleActionRetry);
  await waitPuzzleStatus(s, actorId, 'solving');
  await expectPlayReady(s, actorId);
}

/** Hint once → highlight; from highlight the same button reveals the solution. */
export async function pressPuzzleHint(
  s: ProductSim,
  actorId: string
): Promise<void> {
  await tapAction(s, actorId, Handles.chessPuzzleActionHint);
}

export async function pressPuzzleSolution(
  s: ProductSim,
  actorId: string
): Promise<void> {
  await tapAction(s, actorId, Handles.chessPuzzleActionSolution);
}

/** Chrome back arrow → chess main menu (Puzzle entry visible again). */
export async function pressPuzzleBackToChessMenu(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).expect.visible({ timeoutMs: WAIT_MS });
}

export async function openChessStats(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessMenuStats).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessStatsElo).expect.visible({ timeoutMs: WAIT_MS });
}

export async function readStatsElo(
  s: ProductSim,
  actorId: string
): Promise<number | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessStatsElo).text());
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function readGameLogRowTitle(
  s: ProductSim,
  actorId: string,
  puzzleId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    const node = ui.get(Handles.chessGameLogRowTitle(puzzleId));
    if (!(await node.isVisible())) return null;
    return stripProbe(await node.text());
  } catch {
    return null;
  }
}

export async function isGameLogEmpty(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.chessGameLogEmpty).isVisible();
}

/**
 * Review board sits in the same {@link ChessPuzzleBoardFrame}; happy-dom
 * reports 0×0 so the frame stays gated until `layout()` synthesizes a box.
 */
export async function openReviewFromGameLog(
  s: ProductSim,
  actorId: string,
  puzzleId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessGameLogRow(puzzleId)).tap({ timeoutMs: WAIT_MS });
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  const board = ui.get(Handles.chessPuzzleReviewBoard);
  await pollUntil(
    s,
    async () => {
      if (await frame.isVisible()) await frame.layout();
      return (await board.isVisible()) ? true : null;
    },
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'review board visible' }
  );
}

/**
 * The empty-pool block renders inside the board frame, which happy-dom keeps
 * gated at 0×0 until `layout()` synthesizes a box — same as the live board.
 */
export async function isEmptyPoolVisible(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  if (await frame.isVisible()) await frame.layout();
  return ui.get(Handles.chessPuzzleEmptyPool).isVisible();
}

export async function waitEmptyPool(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleEmptyPool).expect.visible({
    timeoutMs: WAIT_MS,
  });
}

/** Primary action on the exhausted-feed block ("Include played puzzles"). */
export async function tapEmptyPoolPrimaryAction(
  s: ProductSim,
  actorId: string
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await isEmptyPoolVisible(s, actorId)) ? true : null),
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'empty pool block' }
  );
  const ui = await actorUi(s, actorId);
  await ui
    .get(`${Handles.chessPuzzleEmptyPool}-action`)
    .tap({ timeoutMs: WAIT_MS });
}
