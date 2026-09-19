/** Device-local puzzle feed preference: which rating band(s) to sync + pick from. */

import {
  type ChessPuzzleTheme,
  isChessPuzzleTheme,
} from './chess-puzzle-themes';

export const PUZZLE_RATING_BAND_SIZE = 400;
export const PUZZLE_FEED_RATING_MIN = 400;
export const PUZZLE_FEED_RATING_MAX = 3000;
export const PUZZLE_FEED_RATING_DEFAULT = 1200;
export const PUZZLE_FEED_AUTO_OFFSET_MIN = -400;
export const PUZZLE_FEED_AUTO_OFFSET_MAX = 400;
export const PUZZLE_FEED_AUTO_OFFSET_STEP = 50;
/**
 * Half-width of bands subscribed around the effective rating (center ± this).
 * One band each side covers the ±{@link PUZZLE_RATING_BAND_SIZE} pick window
 * wherever the rating sits inside its own band.
 */
export const PUZZLE_FEED_BAND_SPREAD = 1;
/**
 * Rows hydrated per synced rating band (`chessPuzzlePool` server limit).
 * Bands × limit is the local pool a fresh device downloads for one rating.
 */
export const PUZZLE_POOL_BAND_ROW_LIMIT = 1500;
/** Highest rating accepted by the pool query params. */
export const PUZZLE_POOL_RATING_CEILING = 4000;

export const CHESS_PUZZLE_FEED_MODES = ['auto', 'custom'] as const;

export type ChessPuzzleFeedMode = (typeof CHESS_PUZZLE_FEED_MODES)[number];

export const CHESS_PUZZLE_FEED_HISTORY_FILTERS = [
  'any',
  'neverSeen',
  'seen',
  'failed',
] as const;

export type ChessPuzzleFeedHistoryFilter =
  (typeof CHESS_PUZZLE_FEED_HISTORY_FILTERS)[number];

/**
 * §5 result panel auto-advance after a solve: never, one second after the
 * result shows, or at once. Lives in the device-local feed prefs until the
 * settings slice moves settings to a synced table.
 */
export const CHESS_PUZZLE_AUTO_ADVANCE = [
  'off',
  'after1s',
  'immediate',
] as const;

export type ChessPuzzleAutoAdvance = (typeof CHESS_PUZZLE_AUTO_ADVANCE)[number];

/** Delay before auto-advancing, or null when the setting is off. */
export function puzzleAutoAdvanceDelayMs(
  setting: ChessPuzzleAutoAdvance
): number | null {
  if (setting === 'after1s') return 1000;
  if (setting === 'immediate') return 0;
  return null;
}

function readAutoAdvance(value: unknown): ChessPuzzleAutoAdvance {
  return value === 'after1s' || value === 'immediate' ? value : 'off';
}

export type ChessPuzzleFeedConfig = {
  readonly mode: ChessPuzzleFeedMode;
  readonly customRating: number;
  /** Signed offset from puzzle profile rating when `mode === 'auto'`. */
  readonly autoOffset: number;
  /** Empty = any theme. Match puzzles that include any selected theme (OR). */
  readonly themes: readonly ChessPuzzleTheme[];
  readonly historyFilter: ChessPuzzleFeedHistoryFilter;
  readonly autoAdvance: ChessPuzzleAutoAdvance;
};

export const DEFAULT_CHESS_PUZZLE_FEED_CONFIG: ChessPuzzleFeedConfig = {
  mode: 'auto',
  customRating: PUZZLE_FEED_RATING_DEFAULT,
  autoOffset: 0,
  themes: [],
  historyFilter: 'neverSeen',
  autoAdvance: 'off',
};

export function clampPuzzleFeedRating(rating: number): number {
  if (!Number.isFinite(rating)) return PUZZLE_FEED_RATING_DEFAULT;
  return Math.min(
    PUZZLE_FEED_RATING_MAX,
    Math.max(PUZZLE_FEED_RATING_MIN, Math.round(rating))
  );
}

export function clampPuzzleFeedAutoOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.min(
    PUZZLE_FEED_AUTO_OFFSET_MAX,
    Math.max(PUZZLE_FEED_AUTO_OFFSET_MIN, Math.round(offset))
  );
}

function readFeedThemes(value: unknown): readonly ChessPuzzleTheme[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [];
  const out: ChessPuzzleTheme[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !isChessPuzzleTheme(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function readHistoryFilter(value: unknown): ChessPuzzleFeedHistoryFilter {
  if (value === undefined) return 'neverSeen';
  if (
    value === 'any' ||
    value === 'neverSeen' ||
    value === 'seen' ||
    value === 'failed'
  ) {
    return value;
  }
  return 'neverSeen';
}

/**
 * Accepts current configs and legacy KV rows that omit newer fields.
 * Returns a normalized config, or `undefined` when the value is unusable.
 */
export function readChessPuzzleFeedConfig(
  value: unknown
): ChessPuzzleFeedConfig | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const mode = record['mode'];
  const customRating = record['customRating'];
  if (mode !== 'auto' && mode !== 'custom') return undefined;
  if (typeof customRating !== 'number' || !Number.isFinite(customRating)) {
    return undefined;
  }
  const rawOffset = record['autoOffset'];
  const autoOffset =
    rawOffset === undefined
      ? 0
      : typeof rawOffset === 'number' && Number.isFinite(rawOffset)
        ? clampPuzzleFeedAutoOffset(rawOffset)
        : undefined;
  if (autoOffset === undefined) return undefined;
  if (record['themes'] !== undefined && !Array.isArray(record['themes'])) {
    return undefined;
  }
  if (
    record['historyFilter'] !== undefined &&
    record['historyFilter'] !== 'any' &&
    record['historyFilter'] !== 'neverSeen' &&
    record['historyFilter'] !== 'seen' &&
    record['historyFilter'] !== 'failed'
  ) {
    return undefined;
  }
  return {
    mode,
    customRating,
    autoOffset,
    themes: readFeedThemes(record['themes']),
    historyFilter: readHistoryFilter(record['historyFilter']),
    autoAdvance: readAutoAdvance(record['autoAdvance']),
  };
}

export function isChessPuzzleFeedConfig(
  value: unknown
): value is ChessPuzzleFeedConfig {
  return readChessPuzzleFeedConfig(value) !== undefined;
}

export function resolveEffectivePuzzleRating(args: {
  readonly config: ChessPuzzleFeedConfig;
  readonly profileRating: number;
}): number {
  if (args.config.mode === 'custom') {
    return clampPuzzleFeedRating(args.config.customRating);
  }
  const base =
    args.profileRating > 0 ? args.profileRating : PUZZLE_FEED_RATING_DEFAULT;
  return clampPuzzleFeedRating(
    base + clampPuzzleFeedAutoOffset(args.config.autoOffset)
  );
}

/** sync `chess_puzzles` stream bands covering puzzle picking for `rating`. */
export function chessPuzzleSyncRatingBands(rating: number): readonly number[] {
  const centerBand = Math.floor(Math.max(0, rating) / PUZZLE_RATING_BAND_SIZE);
  const maxBand = Math.floor(
    PUZZLE_POOL_RATING_CEILING / PUZZLE_RATING_BAND_SIZE
  );
  const bands: number[] = [];
  for (
    let band = centerBand - PUZZLE_FEED_BAND_SPREAD;
    band <= centerBand + PUZZLE_FEED_BAND_SPREAD;
    band += 1
  ) {
    if (band >= 0 && band <= maxBand) bands.push(band);
  }
  return bands;
}

export type ChessPuzzlePoolRange = {
  readonly ratingMin: number;
  readonly ratingMax: number;
};

/** Inclusive `chessPuzzlePool` params for one sync band index. */
export function chessPuzzlePoolRangeForBand(
  band: number
): ChessPuzzlePoolRange {
  const ratingMin = Math.max(0, band) * PUZZLE_RATING_BAND_SIZE;
  return {
    ratingMin: Math.min(ratingMin, PUZZLE_POOL_RATING_CEILING),
    ratingMax: Math.min(
      ratingMin + PUZZLE_RATING_BAND_SIZE - 1,
      PUZZLE_POOL_RATING_CEILING
    ),
  };
}

/** Pool subscription params for every band around `rating`. */
export function chessPuzzlePoolRangesForRating(
  rating: number
): readonly ChessPuzzlePoolRange[] {
  return chessPuzzleSyncRatingBands(rating).map(chessPuzzlePoolRangeForBand);
}

/** True when history / theme filters can hide otherwise-synced puzzles. */
export function puzzleFeedHasNarrowingFilters(
  config: ChessPuzzleFeedConfig
): boolean {
  return config.historyFilter !== 'any' || config.themes.length > 0;
}

/** Same rating target, but every synced puzzle is eligible again. */
export function widenPuzzleFeedConfig(
  config: ChessPuzzleFeedConfig
): ChessPuzzleFeedConfig {
  return { ...config, historyFilter: 'any', themes: [] };
}

/** Stable string for detecting feed-config edits (modal Done apply). */
export function chessPuzzleFeedConfigFingerprint(
  config: ChessPuzzleFeedConfig
): string {
  const themes = [...config.themes].sort().join(',');
  return [
    config.mode,
    String(config.customRating),
    String(config.autoOffset),
    themes,
    config.historyFilter,
  ].join('|');
}
