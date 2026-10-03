import { actorUi, pollUntil } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { ownSpaceCard, waitActiveSpace } from '@libs/spaces/harness/space-ui';
import { Handles } from '@libs/test-ids';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import { ChessBoardFlows } from '@pkgs/chess-board-core/flows';
import { Chess } from 'chess.js';

const WAIT_MS = 15_000;
const INTERACTIVE_MS = 2_500;
const POLL_MS = 250;

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/\u200b/g, '').trim();
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

export async function isPuzzleSolved(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.chessPuzzleSummary).isVisible()) return true;
  try {
    const debug = stripProbe(await ui.get(Handles.chessPuzzleTestDebug).text());
    return debug.startsWith('solved|');
  } catch {
    return false;
  }
}

async function readTestField(
  s: ProductHarness,
  actorId: string,
  index: number
): Promise<string | undefined> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessPuzzleTestDebug).text());
    return raw.split('|')[index];
  } catch {
    return undefined;
  }
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
        return (await readTestField(s, actorId, 1)) === '1' ? true : null;
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
 * {@link ChessPuzzleBoardFrame} stays gated until `layout()` installs one.
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

export async function openPuzzlePlay(
  s: ProductHarness,
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

/**
 * The same route to the puzzle screen without waiting for a board: offline
 * with no local pool, the screen says the feed is empty instead.
 */
export async function openPuzzlePlayNoWait(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.gameMenuChess).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(Handles.gameMenuChess).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).tap({ timeoutMs: WAIT_MS });
}

/** §5 result panel CTA: "Next puzzle" inside the summary. */
export async function pressPuzzleSummaryNext(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleSummaryNext).tap({ timeoutMs: WAIT_MS });
}

/** The result panel's "Next puzzle" is showing (after a solve). */
export async function isPuzzleSummaryNextVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.chessPuzzleSummaryNext).isVisible();
}

/** Re-open the puzzle board from the chess main menu (already inside chess). */
export async function openPuzzleFromChessMenu(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessMenuPuzzle).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).tap({ timeoutMs: WAIT_MS });
  await expectPlayReady(s, actorId);
}

type ReturnedPuzzleScreen = 'notice' | 'board';

/**
 * The limit or the offline notice is the screen (no board belongs there),
 * or the board itself is ready.
 */
async function returnedPuzzleScreen(
  s: ProductHarness,
  actorId: string
): Promise<ReturnedPuzzleScreen | null> {
  if (await isPuzzleLimitVisible(s, actorId)) return 'notice';
  if (await isPuzzleOfflineNoticeVisible(s, actorId)) return 'notice';
  return (await boardReadyNow(s, actorId)) ? 'board' : null;
}

/**
 * On the puzzle screen, wait until a board is ready or the limit / offline
 * notice is what the screen shows. A board still waits until the solver may
 * move, or the puzzle is already over; a notice does not.
 */
async function settleReturnedPuzzleScreen(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzlePlayScreen).expect.visible({
    timeoutMs: WAIT_MS,
  });
  const settled = await pollUntil(s, () => returnedPuzzleScreen(s, actorId), {
    maxMs: WAIT_MS,
    description: 'puzzle screen settled',
  });
  if (settled === 'board') await waitUntilInteractiveOrSolved(s, actorId);
}

/** Reach the puzzle screen from the chess choices, or one step back. */
async function openPuzzleReturn(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.chessPuzzlePlayScreen).isVisible()) return;
  if (await ui.get(Handles.chessMenuPuzzle).isVisible()) {
    await ui.get(Handles.chessMenuPuzzle).tap({ timeoutMs: WAIT_MS });
    return;
  }
  await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
}

/**
 * Back to the puzzle screen: from the chess choices through the puzzle
 * entry, or one step back from wherever an interruption (signing in) left
 * the actor. A pending attempt comes back as it was. Settles on a ready
 * board, or on the limit / offline notice when that is the screen.
 */
export async function returnToPuzzles(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await openPuzzleReturn(s, actorId);
  await settleReturnedPuzzleScreen(s, actorId);
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
export async function solvePuzzle(
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await waitPuzzleStatus(s, actorId, 'solved');
}

async function readPickStatusField(
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const value = await readPickStatusField(s, actorId, 'pick');
  if (value === undefined || value === 'null' || value.length === 0) {
    return null;
  }
  return value;
}

export async function pressPuzzleNext(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleActionNext).tap({ timeoutMs: WAIT_MS });
}

/**
 * Tap the action bar's Next only if it is on screen right now — the second
 * press of a fast double input. Waiting for it would burn the whole budget
 * whenever the first press already took the chrome away.
 */
export async function pressPuzzleNextIfVisible(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  const next = ui.get(Handles.chessPuzzleActionNext);
  if (await next.isVisible()) await next.tap({ timeoutMs: WAIT_MS });
}

/**
 * Wait until pick-status reports a non-null active id with loading cleared.
 * Does not assert difference — that is the standing property's job.
 */
export async function settleAfterPuzzleNext(
  s: ProductHarness,
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
export type PuzzleTestDebug = {
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
  s: ProductHarness,
  actorId: string
): Promise<PuzzleTestDebug | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessPuzzleTestDebug).text());
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
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const debug = await readPuzzleDebug(s, actorId);
  return debug?.status ?? null;
}

export async function readPuzzleHintStage(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const debug = await readPuzzleDebug(s, actorId);
  return debug?.hintStage ?? null;
}

export async function waitPuzzleStatus(
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string
): Promise<PuzzleSpectatorProbe | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(
      await ui.get(Handles.chessPuzzleTestSpectator).text()
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
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const probe = await readPuzzleSpectator(s, actorId);
  return probe?.statusKind ?? null;
}

/** Where the served puzzle came from: `unseen` / `widened` / `exhausted`. */
export async function readPuzzlePickSource(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return (await readPickStatusField(s, actorId, 'source')) ?? null;
}

/** Whether the attempt on the board can still move the rating (§8 / §9). */
export async function isPuzzleAttemptRated(
  s: ProductHarness,
  actorId: string
): Promise<boolean | null> {
  const raw = await readPickStatusField(s, actorId, 'rated');
  if (raw === undefined) return null;
  return raw === '1';
}

/** Pick state from the hidden pick-status probe (`ready`, `waiting`, …). */
export async function readPuzzlePickState(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return (await readPickStatusField(s, actorId, 'pickState')) ?? null;
}

/** Host abandons the live attempt: Skip → terminal `skipped` status. */
export async function skipPuzzle(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await tapAction(s, actorId, Handles.chessPuzzleActionSkip);
  await waitPuzzleStatus(s, actorId, 'skipped');
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

async function readDisplayFen(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  const ui = await actorUi(s, actorId);
  return pollUntil(
    s,
    async () => {
      const fen = stripProbe(await ui.get(Handles.chessPuzzleTestFen).text());
      return fen.length > 0 ? fen : null;
    },
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'display fen' }
  );
}

/** Display FEN probe: the position the board currently renders. */
export async function readPuzzleDisplayFen(
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(handle).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(handle).tap({ timeoutMs: WAIT_MS });
}

export async function pressPuzzleRetry(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await closePuzzleSummary(s, actorId);
  await tapAction(s, actorId, Handles.chessPuzzleActionRetry);
  await waitPuzzleStatus(s, actorId, 'solving');
  await expectPlayReady(s, actorId);
}

export async function closePuzzleSummary(s: ProductHarness, actorId: string) {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.chessPuzzleSummary).isVisible()) {
    await ui.get(Handles.chessPuzzleSummaryClose).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.chessPuzzleSummary)
      .expect.hidden({ timeoutMs: WAIT_MS });
  }
}

/** Hint once → highlight; from highlight the same button reveals the solution. */
export async function pressPuzzleHint(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await tapAction(s, actorId, Handles.chessPuzzleActionHint);
}

export async function pressPuzzleSolution(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await tapAction(s, actorId, Handles.chessPuzzleActionSolution);
}

/** Chrome back arrow → chess main menu (Puzzle entry visible again). */
export async function pressPuzzleBackToChessMenu(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  // A solved puzzle's summary sits over the board; close it first, as a
  // person must before the header behind it can be pressed.
  await closePuzzleSummary(s, actorId);
  await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).expect.visible({ timeoutMs: WAIT_MS });
}

/** Chrome back arrow from the chess choices → the space's game menu. */
export async function pressChessMenuBackToGameMenu(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessMenuPuzzle).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.gameMenuChess).expect.visible({ timeoutMs: WAIT_MS });
}

export async function openChessStats(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessMenuStats).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessStatsElo).expect.visible({ timeoutMs: WAIT_MS });
}

/**
 * Into a space to reach the game menu: the account's live space when its
 * lobby lists one (a free account hosts one at a time, so another device of
 * it goes into that one), a new one otherwise.
 */
async function enterOrStartSpace(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  const card = await ownSpaceCard(s, actorId);
  if (card !== null) {
    await ui.get(card).tap({ timeoutMs: WAIT_MS });
    // Another device of the host goes in through the join prompt.
    await ui.get(Handles.spaceJoin).tap({ timeoutMs: WAIT_MS });
    return;
  }
  await ui.get(Handles.spaceCreate).tap({ timeoutMs: WAIT_MS });
}

/**
 * The stats screen, from wherever the device is: the chess choices, the
 * puzzle board, the space's game menu, a screen an interruption (signing in)
 * left open, the tabs with the space still open behind them, or the tabs
 * with no space (a device outside any space goes into its account's live
 * space, or opens one). Reading stats changes nothing.
 */
async function returnFromChessScreen(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.chessMenuStats).isVisible()) {
    await openChessStats(s, actorId);
    return true;
  }
  if (await ui.get(Handles.chessPuzzlePlayScreen).isVisible()) {
    await pressPuzzleBackToChessMenu(s, actorId);
    return true;
  }
  if (await ui.get('chess-custom-status').isVisible()) {
    await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
    return true;
  }
  return false;
}

export async function showChessStats(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  let createdSpace = false;
  await pollUntil(
    s,
    async () => {
      if (await ui.get(Handles.chessStatsElo).isVisible()) return true;
      if (await returnFromChessScreen(s, actorId)) return null;
      if (await ui.get(Handles.gameMenuChess).isVisible()) {
        await ui.get(Handles.gameMenuChess).tap({ timeoutMs: WAIT_MS });
      } else if (await ui.get(Handles.spaceClose).isVisible()) {
        // In a space whose game is still coming up: wait for it.
      } else if (await ui.get(Handles.spaceMiniplayer).isVisible()) {
        // The space is still open behind the tabs: back in through its card.
        const card = await ownSpaceCard(s, actorId);
        if (card !== null) await ui.get(card).tap({ timeoutMs: WAIT_MS });
      } else if (await ui.get(Handles.navBack).isVisible()) {
        await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
      } else if (!createdSpace) {
        createdSpace = true;
        await enterOrStartSpace(s, actorId);
      }
      return null;
    },
    { maxMs: WAIT_MS * 2, stepMs: POLL_MS, description: 'the stats screen' }
  );
}

/** Back arrow on the stats screen → chess main menu. */
export async function leaveChessStats(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).expect.visible({ timeoutMs: WAIT_MS });
}

export async function readStatsElo(
  s: ProductHarness,
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

/**
 * The stats screen's rating after each of the latest rated puzzles, oldest
 * first (empty before any rated puzzle).
 */
export async function readStatsRatingHistory(
  s: ProductHarness,
  actorId: string
): Promise<readonly number[]> {
  const ui = await actorUi(s, actorId);
  const ratings: number[] = [];
  for (let index = 0; ; index += 1) {
    const point = ui.get(Handles.chessStatsRatingHistoryPoint(index));
    if (!(await point.isVisible())) break;
    ratings.push(Number.parseInt(stripProbe(await point.text()), 10));
  }
  return ratings;
}

/** Raw rating chip text on the stats screen — `1500` or `1500?` (§8). */
export async function readStatsRatingLabel(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    return stripProbe(await ui.get(Handles.chessStatsElo).text()).trim();
  } catch {
    return null;
  }
}

/** §15 P0 stat tile: rated attempts counted in the ledger. */
export async function readStatsPlayed(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  return readStatTile(s, actorId, Handles.chessStatsPlayed);
}

/** §15 P0 stat tile: rated attempts that ended solved. */
export async function readStatsSolved(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  return readStatTile(s, actorId, Handles.chessStatsSolved);
}

/** §15 P0 stat tile: overall accuracy, as a whole percentage. */
export async function readStatsAccuracy(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  return readStatTile(s, actorId, Handles.chessStatsAccuracy);
}

async function readStatTile(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<number | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(handle).text()).replace('%', '');
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function readGameLogRowTitle(
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  if (await frame.isVisible()) await frame.layout();
  return ui.get(Handles.chessPuzzleEmptyPool).isVisible();
}

/** The permission denial surface that replaces the board at the limit. */
export async function isPuzzleLimitVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  if (await frame.isVisible()) await frame.layout();
  return ui.get(Handles.chessPuzzleLimit).isVisible();
}

/**
 * The limit screen invites the person to sign in for more puzzles (its call
 * to action reads "Sign in"), not just an error.
 */
export async function isPuzzleLimitSignInOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  if (!(await isPuzzleLimitVisible(s, actorId))) return false;
  const ui = await actorUi(s, actorId);
  const action = ui.get(`${Handles.chessPuzzleLimit}-action`);
  if (!(await action.isVisible())) return false;
  return (await action.text())?.trim() === 'Sign in';
}

/**
 * The board well says puzzles need a connection ("You're offline"), not
 * that nothing matches the feed.
 */
export async function isPuzzleOfflineNoticeVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  if (await frame.isVisible()) await frame.layout();
  return ui.get(Handles.chessPuzzleOffline).isVisible();
}

/** The feed bar marks the puzzle on the board "Unrated" (a repeat). */
export async function isPuzzleUnratedNoticeVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.chessPuzzleFeedUnratedLabel).isVisible();
  } catch {
    return false;
  }
}

/** Primary action on the exhausted-feed block ("Include played puzzles"). */
export async function tapEmptyPoolPrimaryAction(
  s: ProductHarness,
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
