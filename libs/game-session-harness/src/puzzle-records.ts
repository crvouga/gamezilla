/**
 * What a solver keeps of the puzzles they played, for any game offering
 * puzzles: the game's puzzle stats (the puzzle rating, puzzles played and
 * solved, accuracy), the game log, and a played puzzle's review — opened
 * from the game log, stepped and jumped through by the controls, the
 * keyboard, a flick or the move list. And the puzzle catalogue a world
 * holds: a puzzle retired from it, and the device's copy of a puzzle.
 */

import { inPuzzleNamespace } from '@libs/game-puzzle-shared/puzzle-namespace';
import { GAME_PUZZLE_SUB } from '@libs/game-puzzle-shared/sub';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql } from '@libs/harness/identity';
import { writeServerFixture } from '@libs/harness/write-server-fixture';
import { ownSpaceCard, waitActiveSpace } from '@libs/spaces-harness/space-ui';
import { Handles } from '@libs/test-ids-shared/handles';
import sql from '@pkgs/sql-root-shared/sql';
import type { DriverKey } from '@pkgs/ui-testing-root-shared/keys';
import { closeResultPanel } from './puzzle-screen';

const WAIT_MS = 15_000;
const POLL_MS = 250;

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/​/g, '').trim();
}

// ----------------------------------------------------------- puzzle stats

/** One step toward the stats from where the device is; true once shown. */
async function stepTowardStats(
  s: ProductHarness,
  actorId: string,
  gameId: string,
  entered: { space: boolean }
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.chessStatsElo).isVisible()) return true;
  if (await ui.get(Handles.gameChoice('stats')).isVisible()) {
    await ui.get(Handles.gameChoice('stats')).tap({ timeoutMs: WAIT_MS });
  } else if (await ui.get(Handles.chessPuzzlePlayScreen).isVisible()) {
    await closeResultPanel(s, actorId);
    await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
  } else if (await ui.get(Handles.gameMenu(gameId)).isVisible()) {
    await ui.get(Handles.gameMenu(gameId)).tap({ timeoutMs: WAIT_MS });
  } else if (await ui.get(Handles.spaceClose).isVisible()) {
    // In a space whose game choice is still coming up: wait for it.
  } else if (await ui.get(Handles.spaceMiniplayer).isVisible()) {
    const card = await ownSpaceCard(s, actorId);
    if (card !== null) await ui.get(card).tap({ timeoutMs: WAIT_MS });
  } else if (await ui.get(Handles.navBack).isVisible()) {
    await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
  } else if (!entered.space) {
    // Outside any space: the account's live space, else a new one.
    entered.space = true;
    const card = await ownSpaceCard(s, actorId);
    if (card === null) {
      await ui.get(Handles.spaceCreate).tap({ timeoutMs: WAIT_MS });
    } else {
      await ui.get(card).tap({ timeoutMs: WAIT_MS });
      await waitActiveSpace(s, actorId);
    }
  }
  return false;
}

/**
 * The game's puzzle stats, from wherever the device is: the board, the
 * game's choices, the space's game choice, or outside the space. Reading
 * them changes nothing.
 */
export const showGamePuzzleStats = scenarioAction({
  name: 'showGamePuzzleStats',
  act: async (s, actorId: string, gameId: string) => {
    const entered = { space: false };
    await pollUntil(
      s,
      async () =>
        (await stepTowardStats(s, actorId, gameId, entered)) ? true : null,
      { maxMs: WAIT_MS * 2, stepMs: POLL_MS, description: 'the puzzle stats' }
    );
  },
});

/** Whether the game's puzzle stats are the screen on show. */
export async function isPuzzleStatsShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.chessStatsElo).isVisible();
}

/** Back from the stats to the game's choices. */
export const leaveGamePuzzleStats = scenarioAction({
  name: 'leaveGamePuzzleStats',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.gameChoice('puzzle'))
      .expect.visible({ timeoutMs: WAIT_MS });
  },
});

async function readNumber(
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

/** The puzzle rating the stats show, or null when they are not shown. */
export function readStatsPuzzleRating(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  return readNumber(s, actorId, Handles.chessStatsElo);
}

/** Puzzles played and solved, and accuracy, as the stats show them. */
export async function readStatsFigures(s: ProductHarness, actorId: string) {
  return {
    played: await readNumber(s, actorId, Handles.chessStatsPlayed),
    solved: await readNumber(s, actorId, Handles.chessStatsSolved),
    accuracy: await readNumber(s, actorId, Handles.chessStatsAccuracy),
  };
}

/** The game log's title for `puzzleId` ("Solved · 1458"), or null. */
export async function readGameLogTitle(
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

// ------------------------------------------------------------------ review

/** The review's probe: the move shown, the line's length, and how reached. */
export type PuzzleReviewProbe = {
  readonly move: number;
  readonly of: number;
  /** The last change slid one move rather than snapping (a jump). */
  readonly animated: boolean;
};

export async function readPuzzleReview(
  s: ProductHarness,
  actorId: string
): Promise<PuzzleReviewProbe | null> {
  try {
    const ui = await actorUi(s, actorId);
    const parts = stripProbe(
      await ui.get(Handles.chessPuzzleReviewTest).text()
    ).split('|');
    if (parts.length < 4) return null;
    const move = Number.parseInt(parts[0] ?? '', 10);
    const of = Number.parseInt(parts[1] ?? '', 10);
    if (!Number.isFinite(move) || !Number.isFinite(of)) return null;
    return { move, of, animated: parts[2] === '1' };
  } catch {
    return null;
  }
}

/** The position the review board shows, in the game's own notation. */
export async function readPuzzleReviewPosition(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    const position = stripProbe(
      await ui.get(Handles.chessPuzzleReviewTestFen).text()
    );
    return position.length > 0 ? position : null;
  } catch {
    return null;
  }
}

/** The review's line, each move written as the move list shows it. */
export async function readPuzzleReviewMoves(
  s: ProductHarness,
  actorId: string
): Promise<readonly string[]> {
  const ui = await actorUi(s, actorId);
  const moves: string[] = [];
  for (let index = 0; ; index += 1) {
    const node = ui.get(Handles.chessPuzzleMovePly(index));
    if (!(await node.isVisible())) break;
    moves.push(stripProbe(await node.text()));
  }
  return moves;
}

/** The move the review's move list highlights, numbered from 1, or null. */
export async function readPuzzleReviewHighlight(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  const ui = await actorUi(s, actorId);
  const node = ui.get(Handles.chessPuzzleMovePlySelected);
  if (!(await node.isVisible())) return null;
  const index = Number.parseInt(stripProbe(await node.text()), 10);
  return Number.isFinite(index) ? index + 1 : null;
}

/** Open `puzzleId`'s review from the game log, once the stats are shown. */
export const openPuzzleReviewFromLog = scenarioAction({
  name: 'openPuzzleReviewFromLog',
  act: async (s, actorId: string, puzzleId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.chessGameLogRow(puzzleId)).tap({ timeoutMs: WAIT_MS });
    const frame = ui.get(Handles.chessPuzzleBoardFrame);
    const board = ui.get(Handles.chessPuzzleReviewBoard);
    await pollUntil(
      s,
      async () => {
        if (await frame.isVisible()) await frame.layout();
        if (!(await board.isVisible())) return null;
        const review = await readPuzzleReview(s, actorId);
        return review !== null && review.of > 0 ? true : null;
      },
      { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'the review' }
    );
  },
});

export type ReviewControl = 'start' | 'back' | 'forward' | 'end';

/** Press one of the review's step and jump controls. */
export const useReviewControl = scenarioAction({
  name: 'useReviewControl',
  act: async (s, actorId: string, control: ReviewControl) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.chessPuzzleMoveNav(control)).tap({
      timeoutMs: WAIT_MS,
    });
    await s.session.waitForIdle();
  },
});

/** Choose a move from the review's move list (`move` from 1). */
export const chooseReviewMove = scenarioAction({
  name: 'chooseReviewMove',
  act: async (s, actorId: string, move: number) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.chessPuzzleMovePly(move - 1)).tap({
      timeoutMs: WAIT_MS,
    });
    await s.session.waitForIdle();
  },
});

/** Press a key the way a person on a keyboard does. */
export const pressReviewKey = scenarioAction({
  name: 'pressReviewKey',
  act: async (s, actorId: string, key: DriverKey) => {
    const ui = await actorUi(s, actorId);
    await ui.key(key);
    await s.session.waitForIdle();
  },
});

/** Flick sideways across the review board (leftward goes forward). */
export const flickReview = scenarioAction({
  name: 'flickReview',
  act: async (s, actorId: string, direction: 'back' | 'forward') => {
    const ui = await actorUi(s, actorId);
    const board = ui.get(Handles.chessPuzzleReviewBoard);
    await board.layout();
    const from = direction === 'forward' ? 0.85 : 0.15;
    const to = direction === 'forward' ? 0.15 : 0.85;
    await board.drag(
      { xRatio: from, yRatio: 0.5 },
      { xRatio: to, yRatio: 0.5 }
    );
    await s.session.waitForIdle();
  },
});

// --------------------------------------------------------------- catalogue

/** Retire `puzzleId` from the catalogue: no feed serves it again. */
export const retireCataloguePuzzle = scenarioAction({
  name: 'retireCataloguePuzzle',
  act: async (s, puzzleId: string) => {
    await writeServerFixture(s, GAME_PUZZLE_SUB.topicMap, async (db) => {
      await db.run(sql`
        UPDATE chess_puzzles
        SET deleted_at = ${new Date(s.harness.clock.now()).toISOString()}
        WHERE id = ${puzzleId}
      `);
    });
  },
});

/** Whether the actor's device holds `puzzleId` as retired. */
export async function isPuzzleRetiredOnDevice(
  s: ProductHarness,
  actorId: string,
  puzzleId: string
): Promise<boolean> {
  const db = actorLocalSql(s, actorId);
  if (db === null) return false;
  const rows = await db.query(sql<{ readonly deleted_at: string | null }>`
    SELECT deleted_at FROM chess_puzzles WHERE id = ${puzzleId} LIMIT 1
  `);
  return rows[0] !== undefined && rows[0].deleted_at !== null;
}

/** The ids of every puzzle in `namespace` the catalogue serves, in order. */
export async function readCataloguePuzzles(
  s: ProductHarness,
  namespace: string
): Promise<readonly string[]> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly id: string;
  }>`
    SELECT id FROM chess_puzzles WHERE deleted_at IS NULL ORDER BY id ASC
  `);
  return rows
    .map((row) => row.id)
    .filter((id) => inPuzzleNamespace(id, namespace));
}

export const PUZZLE_RECORD_ACTIONS = [
  showGamePuzzleStats,
  leaveGamePuzzleStats,
  openPuzzleReviewFromLog,
  useReviewControl,
  chooseReviewMove,
  pressReviewKey,
  flickReview,
  retireCataloguePuzzle,
];
