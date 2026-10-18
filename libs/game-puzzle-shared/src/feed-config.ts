/**
 * A player's puzzle feed choices: which rating band(s) to sync and pick
 * from, the history and theme filters, and the result-panel preferences. An
 * account's choices sync to its devices (`chess_puzzle_feed_settings`); a
 * guest plays the default feed.
 */

import { PUZZLE_RATING_DEFAULT } from './rating';

export const PUZZLE_RATING_BAND_SIZE = 400;
export const PUZZLE_FEED_RATING_MIN = 400;
export const PUZZLE_FEED_RATING_MAX = 3000;
/** §8 seed rating: where a player with no rated attempts sits. */
export const PUZZLE_FEED_RATING_DEFAULT = PUZZLE_RATING_DEFAULT;
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
/**
 * Rows of the nearest-puzzles hydrate (`chessPuzzleNearest`): the fallback
 * when the bands around the target hold no unplayed puzzle.
 */
export const PUZZLE_POOL_NEAREST_ROW_LIMIT = 100;
/** Highest rating accepted by the pool query params. */
export const PUZZLE_POOL_RATING_CEILING = 4000;

export const PUZZLE_FEED_MODES = ['auto', 'custom'] as const;

export type PuzzleFeedMode = (typeof PUZZLE_FEED_MODES)[number];

export const PUZZLE_FEED_HISTORY_FILTERS = [
  'any',
  'neverSeen',
  'seen',
  'failed',
] as const;

export type PuzzleFeedHistoryFilter =
  (typeof PUZZLE_FEED_HISTORY_FILTERS)[number];

/**
 * §5 result panel auto-advance after a solve: never, one second after the
 * result shows, or at once. Part of the synced feed choices.
 */
export const PUZZLE_AUTO_ADVANCE = ['off', 'after1s', 'immediate'] as const;

export type PuzzleAutoAdvance = (typeof PUZZLE_AUTO_ADVANCE)[number];

/** Delay before auto-advancing, or null when the setting is off. */
export function puzzleAutoAdvanceDelayMs(
  setting: PuzzleAutoAdvance
): number | null {
  if (setting === 'after1s') return 1000;
  if (setting === 'immediate') return 0;
  return null;
}

function readAutoAdvance(value: unknown): PuzzleAutoAdvance {
  return value === 'after1s' || value === 'immediate' ? value : 'off';
}

/**
 * The move-list notation stored when none was chosen. The notations a
 * person chooses between are the game's own; this is only the stored
 * default every existing feed setting already carries.
 */
export const DEFAULT_PUZZLE_MOVE_NOTATION = 'san';

/** A theme or notation key: the game's own word, stored verbatim. */
const KEY_PATTERN = /^[A-Za-z0-9]{1,32}$/;

/** Unknown / legacy rows fall back to the stored default notation. */
function readMoveNotation(value: unknown): string {
  return typeof value === 'string' && KEY_PATTERN.test(value)
    ? value
    : DEFAULT_PUZZLE_MOVE_NOTATION;
}

export type PuzzleFeedConfig = {
  readonly mode: PuzzleFeedMode;
  readonly customRating: number;
  /** Signed offset from puzzle profile rating when `mode === 'auto'`. */
  readonly autoOffset: number;
  /** Empty = any theme. Match puzzles that include any selected theme (OR). */
  readonly themes: readonly string[];
  readonly historyFilter: PuzzleFeedHistoryFilter;
  readonly autoAdvance: PuzzleAutoAdvance;
  /**
   * §7 move-list rendering, synced beside `autoAdvance`: one of the game's
   * notations.
   */
  readonly notation: string;
};

export const DEFAULT_PUZZLE_FEED_CONFIG: PuzzleFeedConfig = {
  mode: 'auto',
  customRating: PUZZLE_FEED_RATING_DEFAULT,
  autoOffset: 0,
  themes: [],
  historyFilter: 'neverSeen',
  autoAdvance: 'off',
  notation: DEFAULT_PUZZLE_MOVE_NOTATION,
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

function readFeedThemes(value: unknown): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !KEY_PATTERN.test(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function readHistoryFilter(value: unknown): PuzzleFeedHistoryFilter {
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
export function readPuzzleFeedConfig(
  value: unknown
): PuzzleFeedConfig | undefined {
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
    notation: readMoveNotation(record['notation']),
  };
}

export function isPuzzleFeedConfig(value: unknown): value is PuzzleFeedConfig {
  return readPuzzleFeedConfig(value) !== undefined;
}

export function resolveEffectivePuzzleRating(args: {
  readonly config: PuzzleFeedConfig;
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
export function puzzleSyncRatingBands(rating: number): readonly number[] {
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

export type PuzzlePoolRange = {
  readonly ratingMin: number;
  readonly ratingMax: number;
};

/** Inclusive `chessPuzzlePool` params for one sync band index. */
export function puzzlePoolRangeForBand(band: number): PuzzlePoolRange {
  const ratingMin = Math.max(0, band) * PUZZLE_RATING_BAND_SIZE;
  return {
    ratingMin: Math.min(ratingMin, PUZZLE_POOL_RATING_CEILING),
    ratingMax: Math.min(
      ratingMin + PUZZLE_RATING_BAND_SIZE - 1,
      PUZZLE_POOL_RATING_CEILING
    ),
  };
}

/**
 * The rating the nearest-puzzles hydrate centres on: the middle of
 * `rating`'s band, so per-solve drift inside a band never re-subscribes.
 */
export function puzzleNearestRating(rating: number): number {
  const band = puzzleSyncRatingBands(rating)[PUZZLE_FEED_BAND_SPREAD];
  const range = puzzlePoolRangeForBand(
    band ?? Math.floor(Math.max(0, rating) / PUZZLE_RATING_BAND_SIZE)
  );
  return Math.round((range.ratingMin + range.ratingMax) / 2);
}

/** Pool subscription params for every band around `rating`. */
export function puzzlePoolRangesForRating(
  rating: number
): readonly PuzzlePoolRange[] {
  return puzzleSyncRatingBands(rating).map(puzzlePoolRangeForBand);
}

/** True when history / theme filters can hide otherwise-synced puzzles. */
export function puzzleFeedHasNarrowingFilters(
  config: PuzzleFeedConfig
): boolean {
  return config.historyFilter !== 'any' || config.themes.length > 0;
}

/** Same rating target, but every synced puzzle is eligible again. */
export function widenPuzzleFeedConfig(
  config: PuzzleFeedConfig
): PuzzleFeedConfig {
  return { ...config, historyFilter: 'any', themes: [] };
}

/** Stable string for detecting feed-config edits (modal Done apply). */
export function puzzleFeedConfigFingerprint(config: PuzzleFeedConfig): string {
  const themes = [...config.themes].sort().join(',');
  return [
    config.mode,
    String(config.customRating),
    String(config.autoOffset),
    themes,
    config.historyFilter,
  ].join('|');
}

/**
 * The synced form of a feed config: JSON with a fixed key order, so the same
 * choices always encode to the same text on every device (README.md).
 */
export function encodePuzzleFeedConfig(config: PuzzleFeedConfig): string {
  return JSON.stringify({
    mode: config.mode,
    customRating: config.customRating,
    autoOffset: config.autoOffset,
    themes: [...config.themes],
    historyFilter: config.historyFilter,
    autoAdvance: config.autoAdvance,
    notation: config.notation,
  });
}

/** A synced feed config's text back to a config; `undefined` when malformed. */
export function decodePuzzleFeedConfig(
  text: string
): PuzzleFeedConfig | undefined {
  try {
    return readPuzzleFeedConfig(JSON.parse(text));
  } catch {
    return undefined;
  }
}
