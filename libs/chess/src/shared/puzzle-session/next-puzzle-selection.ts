import { empty, join, type Sql, type SqlFragment, sql } from '@pkgs/sql';

import {
  type ChessPuzzleFeedHistoryFilter,
  PUZZLE_RATING_BAND_SIZE,
} from '../chess/chess-puzzle-feed-config';
import { CHESS_PUZZLE_INTERACTION_KIND } from '../chess/chess-puzzle-interaction-entities';

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
  // Live reads skip sync tombstones (`deleted_at` rows stay on the wire).
  const conditions: SqlFragment[] = [sql<void>`deleted_at IS NULL`];
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

/** Shared tie-break so paging with OFFSET is stable across re-queries. */
const CANDIDATE_ORDER = sql<void>`ORDER BY popularity DESC, nb_plays DESC, id ASC`;

export type BuildPuzzleCandidatesSqlArgs = BuildPuzzleFilterArgs & {
  readonly pickOffset?: number;
};

/** Keep OFFSET inside the catalog so small fixtures still return a page. */
export function capPuzzleCandidateOffset(
  pickOffset: number,
  catalogSize: number
): number {
  if (pickOffset <= 0 || catalogSize <= 0) return 0;
  return Math.min(
    pickOffset,
    Math.max(0, catalogSize - PUZZLE_CANDIDATE_LIMIT)
  );
}

export function buildPuzzleCandidatesSql(
  args: BuildPuzzleCandidatesSqlArgs
): Sql<PuzzleCandidateRow> {
  const pickOffset = args.pickOffset ?? 0;
  const whereClause = whereFromConditions(buildPuzzleFilterConditions(args));
  return sql<PuzzleCandidateRow>`
    SELECT id, rating
    FROM chess_puzzles
    ${whereClause}
    ${CANDIDATE_ORDER}
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
    WHERE deleted_at IS NULL
  `;
}

/**
 * Local rows inside the pick's rating window. 0 while the active band has not
 * hydrated, which is what turns "not downloaded" into the offline copy
 * instead of "you cleared your feed".
 */
export function buildPuzzleBandCountSql(args: {
  readonly rating: number;
  readonly halfWindow: number | null;
}): Sql<PuzzleCountRow> {
  const conditions: SqlFragment[] = [sql<void>`deleted_at IS NULL`];
  if (args.halfWindow !== null) {
    conditions.push(
      sql<void>`rating >= ${Math.max(0, args.rating - args.halfWindow)}`,
      sql<void>`rating <= ${args.rating + args.halfWindow}`
    );
  }
  return sql<PuzzleCountRow>`
    SELECT COUNT(*) AS value
    FROM chess_puzzles
    ${whereFromConditions(conditions)}
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

export const DEFAULT_PUZZLE_RATING = 1200;
/** Prefer candidates within this many rating points before widening to the whole page. */
export const PUZZLE_PREFERRED_BAND = 50;

export type PuzzleCandidateQueryResult = {
  readonly rows: readonly PuzzleCandidateRow[];
  readonly isLoading: boolean;
};

/** Deterministic page offset for `seed`, capped so small catalogs still return rows. */
export function resolvePuzzlePickOffset(
  seed: string,
  catalogSize: number
): number {
  const rawOffset = hashSeed(seed) % (PUZZLE_CANDIDATE_MAX_OFFSET + 1);
  return capPuzzleCandidateOffset(rawOffset, catalogSize);
}

/** Banded page wins while it has rows; otherwise fall back to the unbounded page. */
export function selectPuzzleCandidates(
  banded: PuzzleCandidateQueryResult,
  fallback: PuzzleCandidateQueryResult
): PuzzleCandidateQueryResult {
  if (banded.rows.length > 0) return banded;
  return fallback;
}

export function computeNextPuzzleLoading(args: {
  myId: string;
  banded: PuzzleCandidateQueryResult;
  fallback: PuzzleCandidateQueryResult;
  /** Chosen puzzle id after {@link pickPuzzleIdFromPool}. */
  puzzleId: string | null;
  /** Local `chess_puzzles` row count; 0 means nothing has synced yet. */
  localPuzzleTotal: number;
  /** The pool subscription finished its first hydrate for the current bands. */
  poolReady: boolean;
}): boolean {
  const { myId, banded, fallback, puzzleId, localPuzzleTotal, poolReady } =
    args;
  if (myId.length === 0) return true;
  if (banded.isLoading) return true;
  if (banded.rows.length === 0 && fallback.isLoading) return true;
  if (puzzleId !== null) return false;
  // An empty local catalog is only "loading" until the first hydrate lands.
  return localPuzzleTotal === 0 && !poolReady;
}

/** Profile rating when recorded (> 0), else the default seed rating. */
export function resolveProfilePuzzleRating(raw: unknown): number {
  if (typeof raw === 'number' && raw > 0) return raw;
  return DEFAULT_PUZZLE_RATING;
}
