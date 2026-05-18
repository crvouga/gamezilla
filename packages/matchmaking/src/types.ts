/**
 * Public types shared across the matchmaking package.
 *
 * Everything app-specific is opaque to the library — only ratings (numbers)
 * are compared. Per-player payloads live in `data` and round-trip untouched
 * from `/join` through `onMatch`.
 */

export type PlayerStatus = 'waiting' | 'matched';

export type MatchedPlayer = {
  readonly playerId: string;
  readonly rating: number;
  readonly joinedAt: Date;
  readonly data: Readonly<Record<string, unknown>>;
};

export type StatusResult = {
  readonly status: PlayerStatus;
  readonly data: Readonly<Record<string, unknown>>;
};

export type JoinInput = {
  readonly rating: number;
  readonly data: Readonly<Record<string, unknown>>;
};

export type JoinResult = {
  readonly playerId: string;
};

export type LeaveResult = {
  readonly removed: boolean;
};

export type MatchPassResult = {
  readonly matches: number;
};

export type OnMatch = (
  players: readonly MatchedPlayer[]
) => void | Promise<void>;

/**
 * Tunables for the expanding-radius pairing algorithm.
 *
 * Defaults match the spec: start at ±50 rating, grow by 10 per second of wait
 * time, capped at ±400.
 */
export type RadiusOptions = {
  readonly baseRadius: number;
  readonly radiusGrowthPerSecond: number;
  readonly maxRadius: number;
};

export const DEFAULT_RADIUS_OPTIONS: RadiusOptions = {
  baseRadius: 50,
  radiusGrowthPerSecond: 10,
  maxRadius: 400,
};

export const DEFAULT_MATCH_SIZE = 2;
