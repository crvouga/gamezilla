import { ensureActor, scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { accountIdOf, actorLocalSql } from '@libs/harness/system/identity';
import { bringToFront, partitioned } from '@libs/harness/system/observations';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';
import {
  ChessPuzzlePlayAttr,
  ChessPuzzleResultAttr,
} from '../public/chess-puzzle-play';
import {
  playUntilSolved,
  retryPuzzle,
  returnToOwnSpace,
} from './chess-actions';

export const closePuzzleApp = scenarioAction({
  name: 'closePuzzleApp',
  act: async (s, device: string) => {
    await s.runtime.restartActor(device);
    const remaining = s.actors.keys().next().value;
    if (remaining !== undefined) await bringToFront(s, remaining);
  },
});

export const reopenPuzzleApp = scenarioAction({
  name: 'reopenPuzzleApp',
  act: async (s, device: string) => {
    await ensureActor(s, device);
    if (device !== 'charlie')
      await Promise.resolve(returnToOwnSpace.act(s, device));
  },
});

export const retryFinishedPuzzle = scenarioAction({
  name: 'retryFinishedPuzzle',
  act: async (s, device: string) => {
    await Promise.resolve(retryPuzzle.act(s, device));
    await Promise.resolve(playUntilSolved.act(s, device));
  },
});

function resultName(outcome: string | null, points: number | null): string {
  if (outcome === null) return 'Unfinished';
  if (outcome === 'solved' && points === 1000) return 'CleanSolve';
  if (outcome === 'solved' && points === 500) return 'HintedSolve';
  if (outcome === 'failed' && points === 500) return 'WrongMove';
  if (outcome === 'failed' && points === 0) return 'ShownSolution';
  if (outcome === 'abandoned' && points === 0) return 'Skipped';
  throw new Error(`Contradictory puzzle result: ${outcome}/${String(points)}`);
}

async function records(db: SqlTx, owner: string, puzzle: string) {
  const outcomes = await db.query(sql<{ kind: string }>`
    SELECT kind FROM chess_puzzle_interactions
    WHERE owner_id = ${owner} AND puzzle_id = ${puzzle}
      AND kind IN ('solved', 'failed', 'abandoned') AND deleted_at IS NULL
  `);
  const ratings = await db.query(sql<{ outcome: string; score: number }>`
    SELECT outcome, score_permille AS score FROM chess_puzzle_rating_events
    WHERE owner_id = ${owner} AND puzzle_id = ${puzzle} AND deleted_at IS NULL
  `);
  if (outcomes.length > 1 || ratings.length > 1)
    throw new Error('Puzzle recovery duplicated a result or rating');
  return {
    gameLog: outcomes[0]?.kind ?? 'unfinished',
    ratedResult: resultName(
      ratings[0]?.outcome ?? null,
      ratings[0]?.score ?? null
    ),
  };
}

/** Canonical decided result and each open app's actual local progress rows. */
export async function puzzleRecoveryState(
  s: ProductHarness,
  spaceId: string,
  puzzle: string
) {
  const state = s.harness.roomNode.inspect(`space:${spaceId}`)?.committedState;
  if (state === undefined) throw new Error('No committed puzzle');
  const owner = await accountIdOf(s, 'alice');
  const watcher = await accountIdOf(s, 'bob');
  if (owner === null || watcher === null) throw new Error('Accounts missing');
  // Leaving the board clears its transient state. The rated attempt remains
  // in the account's progress and must still be observed after navigation.
  const firstResult =
    ChessPuzzlePlayAttr.puzzleId.from(state) === puzzle
      ? resultName(
          ChessPuzzleResultAttr.outcome.from(state),
          ChessPuzzleResultAttr.score.from(state)
        )
      : (await records(s.harness.serverSql.sqlClient, owner, puzzle))
          .ratedResult;
  const gameLog = new Map<string, string>();
  const ratedResult = new Map<string, string>();
  const open = new Map<string, boolean>();
  const online = new Map<string, boolean>();
  for (const device of ['alice', 'bob', 'charlie']) {
    open.set(device, s.actors.has(device));
    online.set(
      device,
      !partitioned(s).some((edge) => edge.split('|').includes(device))
    );
    if (!s.actors.has(device)) continue;
    const db = actorLocalSql(s, device);
    if (db === null) throw new Error('Open app has no local database');
    const result = await records(
      db,
      device === 'bob' ? watcher : owner,
      puzzle
    );
    gameLog.set(device, result.gameLog);
    ratedResult.set(device, result.ratedResult);
  }
  return {
    firstResult,
    gameLog,
    ratedResult,
    _open: open,
    _online: online,
  };
}
