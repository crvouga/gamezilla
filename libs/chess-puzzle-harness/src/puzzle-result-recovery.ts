import { retryGamePuzzle } from '@libs/game-session-harness/puzzle-screen';
import { ensureActor, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import {
  accountIdOf,
  actorLocalSql,
  localAccountIdOf,
} from '@libs/harness/identity';
import { bringToFront, partitioned } from '@libs/harness/observations';
import { returnToOwnSpace } from '@libs/spaces-harness/space-actions';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { playUntilSolved, showPersonalChessStatsScreen } from './chess-actions';
import { readRecoveryStats } from './puzzle-recovery-stats';

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
    await Promise.resolve(retryGamePuzzle.act(s, device));
    await Promise.resolve(playUntilSolved.act(s, device));
  },
});

export const viewPuzzleStatsAfterReturn = scenarioAction({
  name: 'viewPuzzleStatsAfterReturn',
  act: async (s, device: string) => {
    await ensureActor(s, device);
    await Promise.resolve(showPersonalChessStatsScreen.act(s, device));
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

/** The durable first result, used to place the second arrival after it. */
export async function readRecordedPuzzleResult(
  s: ProductHarness,
  actor: string,
  puzzle: string
): Promise<string> {
  const owner = await accountIdOf(s, actor);
  if (owner === null) throw new Error('No solver account');
  return (await records(s.harness.serverSql.sqlClient, owner, puzzle))
    .ratedResult;
}

/** Arrival fence for competing finishes; observations still read rendered stats. */
export async function readLocalPuzzleResult(
  s: ProductHarness,
  actor: string,
  puzzle: string
): Promise<string> {
  const owner = await localAccountIdOf(s, actor);
  const db = actorLocalSql(s, actor);
  if (owner === null || db === null) throw new Error('No solver account');
  return (await records(db, owner, puzzle)).ratedResult;
}

/** Each open app reads its own visible stats after the modeled navigation. */
export const viewRecoveryStats = scenarioAction({
  name: 'viewRecoveryStats',
  act: async (s, includeOther: boolean) => {
    for (const device of includeOther
      ? ['alice', 'bob', 'charlie']
      : ['alice', 'bob']) {
      if (!s.actors.has(device)) continue;
      await bringToFront(s, device);
      await Promise.resolve(showPersonalChessStatsScreen.act(s, device));
    }
  },
});

/** Only displayed game logs and ratings are compared with the model. */
export async function puzzleRecoveryState(
  s: ProductHarness,
  puzzle: string,
  readingStats: boolean,
  includeOther: boolean
) {
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
    if (
      !readingStats ||
      !s.actors.has(device) ||
      (device === 'charlie' && !includeOther)
    )
      continue;
    await bringToFront(s, device);
    const result = await readRecoveryStats(s, device, puzzle);
    gameLog.set(device, result.gameLog);
    ratedResult.set(device, result.ratedResult);
  }
  return { gameLog, ratedResult, _open: open, _online: online };
}
