/**
 * Public types shared across the matchmaking package.
 *
 * The matching contract:
 *   - Player payloads are split into `data` (the player's attributes,
 *     branded `AttributeState`) and `formulas` (their ordered list of
 *     acceptance criteria, each a {@link DistanceFormula}).
 *   - Two players match when ANY pair `(fa, fb)` from their formula lists
 *     is mutually satisfied (partition compatibility + per-side distance
 *     within per-side radius). This makes matching asymmetric — A can be
 *     "any opponent within rating 50" while B insists on a region partition.
 *   - When a match happens the queue mints a fresh `matchId` UUID and
 *     stamps it on both rows. Callers poll `status(playerId)` and use
 *     `matchId` as a Durable Object name to bring the match online.
 *
 * Game logic is entirely caller-owned: the library has no opinion on
 * attribute names, scoring, or rating math.
 */

import type { AttributeState, AttributeTag } from '@gamezilla/lib/attribute';

export type PlayerStatus = 'waiting' | 'matched';

export type MatchedPlayer = {
  readonly playerId: string;
  readonly joinedAt: Date;
  readonly data: AttributeState;
};

export type WaitingStatus = {
  readonly status: 'waiting';
  readonly data: AttributeState;
};

export type MatchedStatus = {
  readonly status: 'matched';
  readonly data: AttributeState;
  readonly matchId: string;
  readonly opponents: readonly MatchedPlayer[];
};

export type StatusResult = WaitingStatus | MatchedStatus;

export type JoinInput = {
  readonly data: AttributeState;
  /**
   * Ordered list of acceptance criteria. Semantically an OR — the player
   * matches with anyone for whom *some* pair `(myFormula, theirFormula)`
   * mutually accepts the pair. Must be non-empty.
   */
  readonly formulas: readonly DistanceFormula[];
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

/**
 * One numeric term contributes `weight * |a.value - b.value|` to the pair
 * distance. The tag's parser must yield a finite number; missing attrs raise
 * inside `join()` (tiger-style invariant).
 */
export type DistanceFormulaNumericTerm = {
  readonly tag: AttributeTag<number>;
  readonly weight: number;
};

/**
 * One categorical term contributes a flat `penalty` to the pair distance
 * whenever `a` and `b` differ on this attribute (including when only one side
 * has it). Use for region-preference, queue-preference, etc.
 */
export type DistanceFormulaCategoricalTerm = {
  readonly tag: AttributeTag<unknown>;
  readonly penalty: number;
};

/**
 * Hard-equality filter. Two players are only ever considered as a candidate
 * pair if they agree on every partition attribute. Unlike a categorical
 * penalty (which the expanding radius eventually absorbs), partition is
 * binary: differ on any partition tag and the pair is never compatible, no
 * matter how long either player waits. Use for game type, tournament
 * bracket, queue mode, region tier, etc.
 */
export type DistanceFormulaPartitionTerm = {
  readonly tag: AttributeTag<unknown>;
};

export type DistanceFormula = {
  readonly numeric: readonly DistanceFormulaNumericTerm[];
  readonly categorical?: readonly DistanceFormulaCategoricalTerm[];
  readonly partition?: readonly DistanceFormulaPartitionTerm[];
};

/**
 * Tunables for the expanding-radius pairing algorithm.
 *
 * Defaults match the original spec: start at 50 distance units, grow by 10
 * per second of wait time, capped at 400. "Distance units" are whatever the
 * configured {@link DistanceFormula} produces — the library has no opinion
 * on what they mean.
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
