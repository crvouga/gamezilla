/**
 * A rated puzzle attempt's first result, for any game offering puzzles, as
 * it survives closing the app, losing the connection and a second device:
 * closing and reopening the app, reading the stats again on return, and the
 * result each device shows — its game log and the puzzle rating the stats
 * show, judged against an independent Glicko-2 update from a new solver's
 * 1500 by the known puzzle's own rating, never the product's own result
 * code. Two bookkeeping reads (the server's and a device's stored
 * result) only order a scenario's setup.
 */

import { ensureActor, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  accountIdOf,
  actorLocalSql,
  localAccountIdOf,
} from '@libs/harness-ts/identity';
import { bringToFront, partitioned } from '@libs/harness-ts/observations';
import { returnToOwnSpace } from '@libs/spaces-harness-ts/space-actions';
import {
  GLICKO2_DEFAULT,
  glicko2Update,
} from '@pkgs/glicko2-shared-ts/glicko2';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { turnHarnessGameOf } from './harness-game-of';
import { knownPuzzle, solveKnownPuzzle } from './puzzle-moves';
import {
  readGameLogTitle,
  readStatsFigures,
  readStatsPuzzleRating,
  readStatsRatingHistory,
  showPersonalPuzzleStats,
} from './puzzle-records';
import { retryGamePuzzle } from './puzzle-screen';

/** How an attempt's first result ended, as the puzzle rating counts it. */
export type PuzzleResult =
  | 'Unfinished'
  | 'CleanSolve'
  | 'HintedSolve'
  | 'WrongMove'
  | 'ShownSolution'
  | 'Skipped';

/** What one device shows of the attempt: its game log and rated result. */
export type PuzzleResultShown = {
  readonly gameLog: string;
  readonly ratedResult: string;
};

/** The device's app closes, as swiping it away does; another comes to the front. */
export const closePuzzleApp = scenarioAction({
  name: 'closePuzzleApp',
  act: async (s, device: string) => {
    await s.runtime.restartActor(device);
    const remaining = s.actors.keys().next().value;
    if (remaining !== undefined) await bringToFront(s, remaining);
  },
});

/** The device's app opens again, back in its own space. */
export const reopenPuzzleApp = scenarioAction({
  name: 'reopenPuzzleApp',
  act: async (s, device: string, ownSpace: boolean) => {
    await ensureActor(s, device);
    if (ownSpace) await Promise.resolve(returnToOwnSpace.act(s, device));
  },
});

/** Retry the finished puzzle on the board and solve it this time. */
export const retryFinishedGamePuzzle = scenarioAction({
  name: 'retryFinishedGamePuzzle',
  act: async (s, device: string, gameId: string) => {
    await Promise.resolve(retryGamePuzzle.act(s, device));
    await Promise.resolve(solveKnownPuzzle.act(s, device, gameId));
  },
});

/** The game's own puzzle stats, from Settings, on a device back from away. */
export const viewGamePuzzleStatsOnReturn = scenarioAction({
  name: 'viewGamePuzzleStatsOnReturn',
  act: async (s, device: string, gameId: string) => {
    await ensureActor(s, device);
    await Promise.resolve(showPersonalPuzzleStats.act(s, device, gameId));
  },
});

/** Each open device among `devices` shows its own puzzle stats of `gameId`. */
export const viewEachDevicePuzzleStats = scenarioAction({
  name: 'viewEachDevicePuzzleStats',
  act: async (s, devices: readonly string[], gameId: string) => {
    for (const device of devices) {
      if (!s.actors.has(device)) continue;
      await bringToFront(s, device);
      await Promise.resolve(showPersonalPuzzleStats.act(s, device, gameId));
    }
  },
});

/**
 * The result a puzzle rating and game log title show, from a new solver's
 * 1500, against the known puzzle's own rating and deviation.
 */
function displayedResult(
  title: string | null,
  rating: number,
  opponent: { readonly rating: number; readonly ratingDeviation: number }
): string {
  if (title === null && rating === GLICKO2_DEFAULT.rating) return 'Unfinished';
  const ratingFor = (score: number) =>
    Math.round(
      glicko2Update(GLICKO2_DEFAULT, [
        {
          opponentRating: opponent.rating,
          opponentRd: opponent.ratingDeviation,
          score,
        },
      ]).rating
    );
  if (title?.startsWith('Solved') && rating === ratingFor(1))
    return 'CleanSolve';
  if (title?.startsWith('Solved') && rating === ratingFor(0.5))
    return 'HintedSolve';
  if (title?.startsWith('Failed') && rating === ratingFor(0.5))
    return 'WrongMove';
  if (title?.startsWith('Failed') && rating === ratingFor(0))
    return 'ShownSolution';
  if (title?.startsWith('Abandoned') && rating === ratingFor(0))
    return 'Skipped';
  return `Contradictory displayed result: ${String(title)}/${String(rating)}`;
}

/**
 * What `device`'s open stats of `gameId` show of the first attempt at
 * `puzzleId`, a known puzzle of the game: the game log's outcome and the
 * result its puzzle rating reflects ('contradictory' when they disagree or
 * the attempt counts more than once).
 */
export async function readPuzzleResultShown(
  s: ProductHarness,
  device: string,
  gameId: string,
  puzzleId: string
): Promise<PuzzleResultShown> {
  const { record } = knownPuzzle(turnHarnessGameOf(s, gameId), puzzleId);
  const title = await readGameLogTitle(s, device, puzzleId);
  const rating = await readStatsPuzzleRating(s, device);
  const { played } = await readStatsFigures(s, device);
  const history = await readStatsRatingHistory(s, device);
  if (rating === null || played === null)
    throw new Error(`${device}'s stats are not displayed`);
  if (played > 1 || history.length > 1)
    throw new Error(`${device}'s stats counted one puzzle twice`);
  const result = displayedResult(title, rating, record);
  const counted = result !== 'Unfinished';
  if (played !== Number(counted) || history.length !== Number(counted))
    return { gameLog: 'contradictory', ratedResult: result };
  const gameLog = title?.startsWith('Solved')
    ? 'solved'
    : title?.startsWith('Failed')
      ? 'failed'
      : title?.startsWith('Abandoned')
        ? 'abandoned'
        : 'unfinished';
  return { gameLog, ratedResult: result };
}

function resultName(outcome: string | null, points: number | null): string {
  if (outcome === null) return 'Unfinished';
  if (outcome === 'solved' && points === 1000) return 'CleanSolve';
  if (outcome === 'solved' && points === 500) return 'HintedSolve';
  if (outcome === 'failed' && points === 500) return 'WrongMove';
  if (outcome === 'failed' && points === 0) return 'ShownSolution';
  if (outcome === 'abandoned' && points === 0) return 'Skipped';
  throw new Error(`Contradictory puzzle result: ${outcome}/${String(points)}`);
}

async function storedResult(
  db: SqlTx,
  owner: string,
  puzzle: string
): Promise<string> {
  const ratings = await db.query(sql<{ outcome: string; score: number }>`
    SELECT outcome, score_permille AS score FROM chess_puzzle_rating_events
    WHERE owner_id = ${owner} AND puzzle_id = ${puzzle} AND deleted_at IS NULL
  `);
  if (ratings.length > 1) throw new Error('A puzzle result was rated twice');
  return resultName(ratings[0]?.outcome ?? null, ratings[0]?.score ?? null);
}

/**
 * The first result the server has counted (bookkeeping: a setup waits on
 * it to order a second device's arrival after it).
 */
export async function readRecordedPuzzleResult(
  s: ProductHarness,
  actor: string,
  puzzle: string
): Promise<string> {
  const owner = await accountIdOf(s, actor);
  if (owner === null) throw new Error(`${actor} has no account`);
  return storedResult(s.harness.serverSql.sqlClient, owner, puzzle);
}

/** The first result a device has received (bookkeeping, as above). */
export async function readLocalPuzzleResult(
  s: ProductHarness,
  actor: string,
  puzzle: string
): Promise<string> {
  const owner = await localAccountIdOf(s, actor);
  const db = actorLocalSql(s, actor);
  if (owner === null || db === null)
    throw new Error(`${actor} has no account on the device`);
  return storedResult(db, owner, puzzle);
}

/**
 * What each of `devices` shows of the attempt at `puzzle` while its stats
 * are read (only those `reading` names), and which are open and online.
 */
export async function readPuzzleResultsShown(
  s: ProductHarness,
  args: {
    readonly gameId: string;
    readonly puzzle: string;
    readonly devices: readonly string[];
    readonly reading: readonly string[];
  }
) {
  const gameLog = new Map<string, string>();
  const ratedResult = new Map<string, string>();
  const open = new Map<string, boolean>();
  const online = new Map<string, boolean>();
  for (const device of args.devices) {
    open.set(device, s.actors.has(device));
    online.set(
      device,
      !partitioned(s).some((edge) => edge.split('|').includes(device))
    );
    if (!args.reading.includes(device) || !s.actors.has(device)) continue;
    await bringToFront(s, device);
    const shown = await readPuzzleResultShown(
      s,
      device,
      args.gameId,
      args.puzzle
    );
    gameLog.set(device, shown.gameLog);
    ratedResult.set(device, shown.ratedResult);
  }
  return { gameLog, ratedResult, open, online };
}

export const PUZZLE_RESULT_RECOVERY_ACTIONS = [
  closePuzzleApp,
  reopenPuzzleApp,
  retryFinishedGamePuzzle,
  viewGamePuzzleStatsOnReturn,
  viewEachDevicePuzzleStats,
];
