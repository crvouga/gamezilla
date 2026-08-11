/** Device-local puzzle feed preference: which rating band(s) to sync + pick from. */

export const PUZZLE_RATING_BAND_SIZE = 400;
export const PUZZLE_FEED_RATING_MIN = 400;
export const PUZZLE_FEED_RATING_MAX = 3000;
export const PUZZLE_FEED_RATING_DEFAULT = 1200;
export const PUZZLE_FEED_AUTO_OFFSET_MIN = -400;
export const PUZZLE_FEED_AUTO_OFFSET_MAX = 400;
export const PUZZLE_FEED_AUTO_OFFSET_STEP = 50;
/** Half-width of bands subscribed around the effective rating (center ± this). */
export const PUZZLE_FEED_BAND_SPREAD = 2;

export const CHESS_PUZZLE_FEED_MODES = ['auto', 'custom'] as const;

export type ChessPuzzleFeedMode = (typeof CHESS_PUZZLE_FEED_MODES)[number];

export type ChessPuzzleFeedConfig = {
  readonly mode: ChessPuzzleFeedMode;
  readonly customRating: number;
  /** Signed offset from puzzle profile rating when `mode === 'auto'`. */
  readonly autoOffset: number;
};

export const DEFAULT_CHESS_PUZZLE_FEED_CONFIG: ChessPuzzleFeedConfig = {
  mode: 'auto',
  customRating: PUZZLE_FEED_RATING_DEFAULT,
  autoOffset: 0,
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

/**
 * Accepts current configs and legacy KV rows that omit `autoOffset`.
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
  return {
    mode,
    customRating,
    autoOffset,
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
  const bands: number[] = [];
  for (
    let band = centerBand - PUZZLE_FEED_BAND_SPREAD;
    band <= centerBand + PUZZLE_FEED_BAND_SPREAD;
    band += 1
  ) {
    if (band >= 0) bands.push(band);
  }
  return bands;
}
