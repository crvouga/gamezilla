import { empty, join, type Sql, type SqlFragment, sql } from '@pkgs/sql';

import {
  type ChessPuzzleFeedHistoryFilter,
  PUZZLE_RATING_BAND_SIZE,
} from '../../shared/chess-puzzle-feed-config';
import { CHESS_PUZZLE_INTERACTION_KIND } from '../../shared/chess-puzzle-interaction-entities';

export { chessPuzzleSyncRatingBands } from '../../shared/chess-puzzle-feed-config';

export const PUZZLE_NEXT_MAX_BAND = PUZZLE_RATING_BAND_SIZE;
export const PUZZLE_CANDIDATE_LIMIT = 50;
/** Rotates candidate window so "Next" does not always hit the same top-N popular puzzles. */
export const PUZZLE_CANDIDATE_MAX_OFFSET = 150;

export function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export type PuzzleCandidateRow = {
  readonly id: string;
  readonly rating: number;
};

export type BuildPuzzleFilterArgs = {
  readonly rating: number;
  readonly halfWindow: number | null;
  readonly ownerId: string;
  readonly historyFilter: ChessPuzzleFeedHistoryFilter;
  readonly themes: readonly string[];
  readonly currentPuzzleId: string | null;
};

function buildHistoryCondition(
  ownerId: string,
  historyFilter: ChessPuzzleFeedHistoryFilter
): SqlFragment | null {
  if (ownerId.length === 0 || historyFilter === 'any') return null;
  if (historyFilter === 'neverSeen') {
    return sql<void>`
      id NOT IN (
        SELECT puzzle_id
        FROM chess_puzzle_interactions
        WHERE owner_id = ${ownerId}
      )
    `;
  }
  if (historyFilter === 'seen') {
    return sql<void>`
      id IN (
        SELECT puzzle_id
        FROM chess_puzzle_interactions
        WHERE owner_id = ${ownerId}
      )
    `;
  }
  return sql<void>`
    id IN (
      SELECT puzzle_id
      FROM chess_puzzle_interactions
      WHERE owner_id = ${ownerId}
    )
    AND id NOT IN (
      SELECT puzzle_id
      FROM chess_puzzle_interactions
      WHERE owner_id = ${ownerId}
        AND kind = ${CHESS_PUZZLE_INTERACTION_KIND.solved}
    )
  `;
}

function buildThemeCondition(themes: readonly string[]): SqlFragment | null {
  if (themes.length === 0) return null;
  return sql<void>`
    EXISTS (
      SELECT 1
      FROM json_each(themes) AS theme_row
      WHERE theme_row.value IN (${join([...themes])})
    )
  `;
}

export function buildPuzzleFilterConditions(
  args: BuildPuzzleFilterArgs
): SqlFragment[] {
  const conditions: SqlFragment[] = [];
  if (args.halfWindow !== null) {
    conditions.push(
      sql<void>`rating >= ${Math.max(0, args.rating - args.halfWindow)}`,
      sql<void>`rating <= ${args.rating + args.halfWindow}`
    );
  }
  const history = buildHistoryCondition(args.ownerId, args.historyFilter);
  if (history !== null) conditions.push(history);
  const themes = buildThemeCondition(args.themes);
  if (themes !== null) conditions.push(themes);
  if (args.currentPuzzleId !== null && args.currentPuzzleId.length > 0) {
    conditions.push(sql<void>`id != ${args.currentPuzzleId}`);
  }
  return conditions;
}

function whereFromConditions(conditions: SqlFragment[]): SqlFragment {
  if (conditions.length === 0) return empty;
  return sql<void>`WHERE ${join(conditions, ' AND ')}`;
}

export type BuildPuzzleCandidatesSqlArgs = BuildPuzzleFilterArgs & {
  readonly pickOffset?: number;
};

export function buildPuzzleCandidatesSql(
  args: BuildPuzzleCandidatesSqlArgs
): Sql<PuzzleCandidateRow> {
  const pickOffset = args.pickOffset ?? 0;
  const whereClause = whereFromConditions(buildPuzzleFilterConditions(args));
  return sql<PuzzleCandidateRow>`
    SELECT id, rating
    FROM chess_puzzles
    ${whereClause}
    ORDER BY popularity DESC
    LIMIT ${PUZZLE_CANDIDATE_LIMIT}
    OFFSET ${pickOffset}
  `;
}

export type PuzzleCountRow = { readonly value: number };

export function buildPuzzleMatchedCountSql(
  args: BuildPuzzleFilterArgs
): Sql<PuzzleCountRow> {
  const whereClause = whereFromConditions(buildPuzzleFilterConditions(args));
  return sql<PuzzleCountRow>`
    SELECT COUNT(*) AS value
    FROM chess_puzzles
    ${whereClause}
  `;
}

export function buildPuzzleTotalCountSql(): Sql<PuzzleCountRow> {
  return sql<PuzzleCountRow>`
    SELECT COUNT(*) AS value
    FROM chess_puzzles
  `;
}

export function pickPuzzleIdFromPool(args: {
  rows: readonly PuzzleCandidateRow[];
  rating: number;
  preferredBand: number;
  seed: string;
}): string | null {
  const { rows, rating, preferredBand, seed } = args;
  if (rows.length === 0) return null;
  const inBand = rows.filter(
    (r) => Math.abs(r.rating - rating) <= preferredBand
  );
  const pool = inBand.length > 0 ? inBand : rows;
  const idx = hashSeed(seed) % pool.length;
  return pool[idx]?.id ?? null;
}
