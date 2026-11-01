import type { Sql, SqlFragment } from '@pkgs/sql-root-shared-ts/sql';
import sql, { empty, join } from '@pkgs/sql-root-shared-ts/sql';

import type { PuzzleFeedHistoryFilter } from './feed-config';
import { PUZZLE_RATING_BAND_SIZE } from './feed-config';
import { PUZZLE_INTERACTION_KIND } from './interaction-entities';
import { puzzleNamespaceCondition } from './puzzle-namespace';
import {
  PUZZLE_RATING_DEFAULT,
  PUZZLE_RATING_DEFAULT_RD,
  PUZZLE_RATING_RD_MIN,
} from './rating';

export const PUZZLE_NEXT_MAX_BAND = PUZZLE_RATING_BAND_SIZE;

/**
 * §9 selection window: ±100 once the rating is settled, ±200 while the
 * deviation is still at its maximum. Linear in RD between the two:
 *
 *   half = 100 + 100 × clamp((RD − 30) / (350 − 30), 0, 1)
 *
 * so a brand new player (RD 350) gets ±200 and a settled one (RD ≤ 30) ±100.
 */
export const PUZZLE_WINDOW_HALF_MIN = 100;
export const PUZZLE_WINDOW_HALF_MAX = 200;

export function puzzleSelectionHalfWindow(ratingDeviation: number): number {
  if (!Number.isFinite(ratingDeviation)) return PUZZLE_WINDOW_HALF_MAX;
  const span = PUZZLE_RATING_DEFAULT_RD - PUZZLE_RATING_RD_MIN;
  const over = Math.min(
    Math.max(ratingDeviation - PUZZLE_RATING_RD_MIN, 0),
    span
  );
  return Math.round(
    PUZZLE_WINDOW_HALF_MIN +
      (PUZZLE_WINDOW_HALF_MAX - PUZZLE_WINDOW_HALF_MIN) * (over / span)
  );
}

/**
 * §9 quality floor. The Lichess corpus ships `popularity` (a −100…100 score
 * derived from up/down votes) and `nb_plays`; it has **no report-count
 * column**, so those two are the whole filter. Anything below either bar is
 * never served, in any mode — including the exhausted-pool fallback.
 */
export const PUZZLE_MIN_POPULARITY = 50;
export const PUZZLE_MIN_PLAYS = 5;
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
  /** The game whose puzzles are picked (its puzzle namespace). */
  readonly namespace: string;
  readonly rating: number;
  readonly halfWindow: number | null;
  readonly ownerId: string;
  readonly historyFilter: PuzzleFeedHistoryFilter;
  readonly themes: readonly string[];
  readonly currentPuzzleId: string | null;
};

function buildHistoryCondition(
  ownerId: string,
  historyFilter: PuzzleFeedHistoryFilter
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
        AND kind = ${PUZZLE_INTERACTION_KIND.solved}
    )
  `;
}

/**
 * Theme match on the synced JSON array. SQLite does not resolve an outer
 * column inside a subquery's table-valued function (`json_each(themes)` in an
 * `EXISTS`), so the local read tests the serialized array for the quoted
 * theme id — exact because ids are quoted (`"mate"` never matches
 * `"mateIn1"`).
 */
function buildThemeCondition(themes: readonly string[]): SqlFragment | null {
  if (themes.length === 0) return null;
  const matches = themes.map(
    (theme) => sql<void>`instr(themes, ${`"${theme}"`}) > 0`
  );
  return sql<void>`(${join(matches, ' OR ')})`;
}

/** §9 quality bars, applied to every candidate read. */
function qualityConditions(): SqlFragment[] {
  return [
    sql<void>`popularity >= ${PUZZLE_MIN_POPULARITY}`,
    sql<void>`nb_plays >= ${PUZZLE_MIN_PLAYS}`,
  ];
}

export function buildPuzzleFilterConditions(
  args: BuildPuzzleFilterArgs
): SqlFragment[] {
  // Live reads skip sync tombstones (`deleted_at` rows stay on the wire).
  const conditions: SqlFragment[] = [
    sql<void>`deleted_at IS NULL`,
    puzzleNamespaceCondition(args.namespace),
    ...qualityConditions(),
  ];
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

/**
 * The rating window's page (rotated by `pickOffset`), or — with no window —
 * the unplayed puzzles nearest the feed target first (§9 fallback).
 */
export function buildPuzzleCandidatesSql(
  args: BuildPuzzleCandidatesSqlArgs
): Sql<PuzzleCandidateRow> {
  const pickOffset = args.pickOffset ?? 0;
  const whereClause = whereFromConditions(buildPuzzleFilterConditions(args));
  if (args.halfWindow === null) {
    return sql<PuzzleCandidateRow>`
      SELECT id, rating
      FROM chess_puzzles
      ${whereClause}
      ORDER BY ABS(rating - ${args.rating}) ASC, popularity DESC,
        nb_plays DESC, id ASC
      LIMIT ${PUZZLE_CANDIDATE_LIMIT}
    `;
  }
  return sql<PuzzleCandidateRow>`
    SELECT id, rating
    FROM chess_puzzles
    ${whereClause}
    ${CANDIDATE_ORDER}
    LIMIT ${PUZZLE_CANDIDATE_LIMIT}
    OFFSET ${pickOffset}
  `;
}

export type PuzzleExhaustedCandidateRow = PuzzleCandidateRow & {
  readonly last_at: string | null;
};

export type BuildExhaustedPuzzleCandidatesArgs = {
  readonly namespace: string;
  readonly ownerId: string;
  readonly themes: readonly string[];
  readonly currentPuzzleId: string | null;
};

/**
 * §9 pool exhaustion: once nothing unseen is left, serve what the player
 * attempted longest ago. The rating window is dropped on purpose — an
 * exhausted feed should keep working, not go blank — but the §9 quality bars
 * still apply. These attempts are unrated: the puzzle already has a ledger
 * row, so `ratePuzzleAttempt` leaves the rating alone (§8).
 */
export function buildExhaustedPuzzleCandidatesSql(
  args: BuildExhaustedPuzzleCandidatesArgs
): Sql<PuzzleExhaustedCandidateRow> {
  const conditions: SqlFragment[] = [
    sql<void>`deleted_at IS NULL`,
    puzzleNamespaceCondition(args.namespace),
    ...qualityConditions(),
    sql<void>`id IN (
      SELECT puzzle_id
      FROM chess_puzzle_interactions
      WHERE owner_id = ${args.ownerId}
    )`,
  ];
  const themes = buildThemeCondition(args.themes);
  if (themes !== null) conditions.push(themes);
  if (args.currentPuzzleId !== null && args.currentPuzzleId.length > 0) {
    conditions.push(sql<void>`id != ${args.currentPuzzleId}`);
  }
  return sql<PuzzleExhaustedCandidateRow>`
    SELECT
      id,
      rating,
      (
        SELECT MAX(i.at)
        FROM chess_puzzle_interactions i
        WHERE i.owner_id = ${args.ownerId}
          AND i.puzzle_id = chess_puzzles.id
      ) AS last_at
      , (
        SELECT MAX(i.activity_order)
        FROM chess_puzzle_interactions i
        WHERE i.owner_id = ${args.ownerId}
          AND i.puzzle_id = chess_puzzles.id
      ) AS last_order
    FROM chess_puzzles
    ${whereFromConditions(conditions)}
    ORDER BY last_order ASC, last_at ASC, id ASC
    LIMIT ${PUZZLE_CANDIDATE_LIMIT}
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

export function buildPuzzleTotalCountSql(
  namespace: string
): Sql<PuzzleCountRow> {
  return sql<PuzzleCountRow>`
    SELECT COUNT(*) AS value
    FROM chess_puzzles
    WHERE deleted_at IS NULL
      AND ${puzzleNamespaceCondition(namespace)}
  `;
}

/**
 * Local rows inside the pick's rating window. 0 while the active band has not
 * hydrated, which is what turns "not downloaded" into the offline copy
 * instead of "you cleared your feed".
 */
export function buildPuzzleBandCountSql(args: {
  readonly namespace: string;
  readonly rating: number;
  readonly halfWindow: number | null;
}): Sql<PuzzleCountRow> {
  const conditions: SqlFragment[] = [
    sql<void>`deleted_at IS NULL`,
    puzzleNamespaceCondition(args.namespace),
  ];
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

export const DEFAULT_PUZZLE_RATING = PUZZLE_RATING_DEFAULT;
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

/**
 * Where the served puzzle came from:
 *
 *   - `unseen`: inside the ±window around the rating — the §9 default;
 *   - `widened`: the unseen puzzle nearest the rating, when the window had
 *     nothing;
 *   - `exhausted`: everything is played, so the oldest attempt comes round
 *     again — and it is unrated.
 */
export type PuzzlePickSource = 'unseen' | 'widened' | 'exhausted';

export type PuzzlePick = {
  readonly puzzleId: string | null;
  readonly source: PuzzlePickSource | null;
};

export function pickNextPuzzle(args: {
  readonly banded: PuzzleCandidateQueryResult;
  readonly fallback: PuzzleCandidateQueryResult;
  readonly exhausted: readonly PuzzleExhaustedCandidateRow[];
  readonly rating: number;
  readonly seed: string;
}): PuzzlePick {
  const { rating, seed } = args;
  if (args.banded.rows.length > 0) {
    return {
      puzzleId: pickPuzzleIdFromPool({
        rows: args.banded.rows,
        rating,
        preferredBand: PUZZLE_PREFERRED_BAND,
        seed,
      }),
      source: 'unseen',
    };
  }
  // Nothing in the window: the unplayed puzzle nearest the target, which
  // the fallback page lists first.
  const nearest = args.fallback.rows[0];
  if (nearest !== undefined) return { puzzleId: nearest.id, source: 'widened' };
  // Oldest-attempted first: deterministic, not seeded — the point is that the
  // puzzle the player has not seen in longest comes back first.
  const oldest = args.exhausted[0];
  if (oldest !== undefined) return { puzzleId: oldest.id, source: 'exhausted' };
  return { puzzleId: null, source: null };
}

export function computeNextPuzzleLoading(args: {
  myId: string;
  banded: PuzzleCandidateQueryResult;
  fallback: PuzzleCandidateQueryResult;
  /** The §9 exhausted-pool page (oldest-attempted first). */
  exhausted: PuzzleCandidateQueryResult;
  /** Chosen puzzle id after {@link pickPuzzleIdFromPool}. */
  puzzleId: string | null;
  /** Local `chess_puzzles` row count; 0 means nothing has synced yet. */
  localPuzzleTotal: number;
  /** The pool subscription finished its first hydrate for the current bands. */
  poolReady: boolean;
  /** The device is connected; offline, no pool is on its way. */
  online: boolean;
}): boolean {
  const { myId, banded, fallback, puzzleId, localPuzzleTotal } = args;
  // Offline, nothing more will download: what is on the device is the pool.
  const poolReady = args.poolReady || !args.online;
  if (myId.length === 0) return true;
  if (banded.isLoading) return true;
  if (banded.rows.length === 0 && fallback.isLoading) return true;
  if (
    banded.rows.length === 0 &&
    fallback.rows.length === 0 &&
    args.exhausted.isLoading
  ) {
    return true;
  }
  // §9: never fall out of the ±window just because it has not downloaded
  // yet. Bands land one response at a time, so an empty window before the
  // first hydrate means "not here yet", not "nothing at your level".
  if (banded.rows.length === 0 && !poolReady) return true;
  if (puzzleId !== null) return false;
  // An empty local catalog is only "loading" until the first hydrate lands.
  return localPuzzleTotal === 0 && !poolReady;
}

/** Profile rating when recorded (> 0), else the default seed rating. */
export function resolveProfilePuzzleRating(raw: unknown): number {
  if (typeof raw === 'number' && raw > 0) return raw;
  return DEFAULT_PUZZLE_RATING;
}
