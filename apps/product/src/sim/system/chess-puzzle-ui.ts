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

/** §5 result panel CTA: "Next puzzle" inside the summary. */
export async function pressPuzzleSummaryNext(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleSummaryNext).tap({ timeoutMs: WAIT_MS });
}

/** Re-open the puzzle board from the chess main menu (already inside chess). */
export async function openPuzzleFromChessMenu(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
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
  await waitBoardReady(s, actorId);
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

/** The prefetched next puzzle id (pick status), before Next is pressed. */
export async function readNextPuzzleId(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const value = await readPickStatusField(s, actorId, 'pick');
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

/** `status|interactive|solveIdx|moves|solution|hintStage|rating|themes` probe. */
export type PuzzleE2eDebug = {
  readonly status: string;
  readonly interactive: boolean;
  readonly solveIdx: number;
  readonly moves: string;
  readonly solutionUci: string;
  readonly hintStage: string;
  readonly puzzleRating: number | null;
  readonly themes: readonly string[];
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
    const puzzleRating = Number.parseInt(parts[6] ?? '', 10);
    return {
      status: parts[0] ?? '',
      interactive: parts[1] === '1',
      solveIdx: Number.parseInt(parts[2] ?? '0', 10),
      moves: parts[3] ?? '',
      solutionUci: parts[4] ?? '',
      hintStage: parts[5] ?? '',
      puzzleRating: Number.isFinite(puzzleRating) ? puzzleRating : null,
      themes: (parts[7] ?? '').split(',').filter((theme) => theme.length > 0),
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

export type PuzzleSpectatorProbe = {
  readonly spectating: boolean;
  readonly role: 'host' | 'guest' | 'unknown';
  readonly statusKind: string;
  readonly clockMs: number | null;
  readonly recommendations: readonly {
    readonly by: string;
    readonly from: string;
    readonly to: string;
  }[];
};

function parseRecommendationProbe(
  raw: string
): PuzzleSpectatorProbe['recommendations'] {
  if (raw.length === 0) return [];
  return raw.split(',').flatMap((entry) => {
    const [by, squares] = entry.split(':');
    if (by === undefined || squares === undefined || squares.length < 4) {
      return [];
    }
    return [{ by, from: squares.slice(0, 2), to: squares.slice(2, 4) }];
  });
}

/** Watcher/clock probe: who is spectating, the header kind, elapsed ms, recs. */
export async function readPuzzleSpectator(
  s: ProductSim,
  actorId: string
): Promise<PuzzleSpectatorProbe | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(
      await ui.get(Handles.chessPuzzleE2eSpectator).text()
    );
    const fields: Record<string, string> = {};
    for (const part of raw.split(' ')) {
      const at = part.indexOf('=');
      if (at > 0) fields[part.slice(0, at)] = part.slice(at + 1);
    }
    const clock = fields['clock'];
    const role = fields['role'];
    return {
      spectating: fields['spectating'] === '1',
      role: role === 'host' || role === 'guest' ? role : 'unknown',
      statusKind: fields['kind'] ?? '',
      clockMs: clock !== undefined && clock !== '-' ? Number(clock) : null,
      recommendations: parseRecommendationProbe(fields['recs'] ?? ''),
    };
  } catch {
    return null;
  }
}

export async function readPuzzleStatusKind(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const probe = await readPuzzleSpectator(s, actorId);
  return probe?.statusKind ?? null;
}

/** §9 half-window the pick used, from the pick-status probe. */
export async function readPuzzleSelectionWindow(
  s: ProductSim,
  actorId: string
): Promise<number | null> {
  const raw = await readPickStatusField(s, actorId, 'window');
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** Where the served puzzle came from: `unseen` / `widened` / `exhausted`. */
export async function readPuzzlePickSource(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  return (await readPickStatusField(s, actorId, 'source')) ?? null;
}

/** Whether the attempt on the board can still move the rating (§8 / §9). */
export async function isPuzzleAttemptRated(
  s: ProductSim,
  actorId: string
): Promise<boolean | null> {
  const raw = await readPickStatusField(s, actorId, 'rated');
  if (raw === undefined) return null;
  return raw === '1';
}

/** Pick state from the hidden pick-status probe (`ready`, `waiting`, …). */
export async function readPuzzlePickState(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  return (await readPickStatusField(s, actorId, 'pickState')) ?? null;
}

/** Host abandons the live attempt: Skip → terminal `skipped` status. */
export async function skipPuzzle(
  s: ProductSim,
  actorId: string
): Promise<void> {
  await tapAction(s, actorId, Handles.chessPuzzleActionSkip);
  await waitPuzzleStatus(s, actorId, 'skipped');
}

/** A spectator drags a legal move; the room records it as a suggestion. */
export async function suggestPuzzleMove(
  s: ProductSim,
  actorId: string,
  from: Square,
  to: Square
): Promise<void> {
  await waitBoardReady(s, actorId);
  const board = await puzzleBoard(s, actorId);
  await board.drag(from, to);
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

/** Display FEN probe: the position the board currently renders. */
export async function readPuzzleDisplayFen(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  try {
    return await readDisplayFen(s, actorId);
  } catch {
    return null;
  }
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
  // A solved puzzle's summary sits over the board; close it first, as a
  // person must before the header behind it can be pressed.
  if (await ui.get(Handles.chessPuzzleSummary).isVisible()) {
    await ui.get(Handles.chessPuzzleSummaryClose).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.chessPuzzleSummary)
      .expect.hidden({ timeoutMs: WAIT_MS });
  }
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

/** Back arrow on the stats screen → chess main menu. */
export async function leaveChessStats(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).expect.visible({ timeoutMs: WAIT_MS });
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

/** Raw rating chip text on the stats screen — `1500` or `1500?` (§8). */
export async function readStatsRatingLabel(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    return stripProbe(await ui.get(Handles.chessStatsElo).text()).trim();
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

/** The permission denial surface that replaces the board at the limit. */
export async function isPuzzleLimitVisible(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  if (await frame.isVisible()) await frame.layout();
  return ui.get(Handles.chessPuzzleLimit).isVisible();
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
