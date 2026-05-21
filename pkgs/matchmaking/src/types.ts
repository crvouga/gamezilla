/**
 * Public types shared across the matchmaking package.
 *
 * The matching contract:
 *   - Participant payloads are split into `data` (the participant's
 *     attributes, branded `AttributeState`) and `formulas` (their ordered
 *     list of acceptance criteria, each a {@link DistanceFormula}).
 *   - Two participants match when ANY pair `(fa, fb)` from their formula
 *     lists is mutually satisfied (partition compatibility + per-side
 *     distance within per-side radius). Matching is asymmetric — A can be
 *     "any peer within rating 50" while B insists on a region partition.
 *   - When a match happens the queue mints a fresh `matchId` UUID and
 *     stamps it on both rows. Callers poll `status(participantId)` and use
 *     `matchId` as a downstream handle (e.g. a Durable Object name) to
 *     bring the match online.
 *
 * The library is use-case agnostic: it has no opinion on what a match is
 * for (competitive, cooperative, conversational, hiring, dating, etc.),
 * on attribute names, scoring, or rating math. The caller defines all
 * domain semantics through `data` and `formulas`.
 */

import type { AttributeState, AttributeTag } from '@pkgs/attribute';

export type ParticipantStatus = 'waiting' | 'matched';

export type MatchedParticipant = {
  readonly participantId: string;
  readonly joinedAt: Date;
  readonly data: AttributeState;
  /**
   * Free-form caller payload the participant supplied on join (or via
   * `Matchmaking.updateFormulas`). Present iff the caller set it; null
   * when unset. Bounded by
   * {@link MATCHMAKING_PAYLOAD_LIMITS}.maxMetadataBytes (1024 bytes).
   */
  readonly metadata?: Record<string, unknown> | null;
};

export type WaitingStatus = {
  readonly status: 'waiting';
  readonly data: AttributeState;
  readonly metadata?: Record<string, unknown> | null;
};

export type MatchedStatus = {
  readonly status: 'matched';
  readonly data: AttributeState;
  readonly matchId: string;
  readonly metadata?: Record<string, unknown> | null;
  /**
   * The other participants matched with this one. Named neutrally because
   * the library has no opinion on the relationship between matched
   * participants (competitive, cooperative, conversational, etc.).
   */
  readonly peers: readonly MatchedParticipant[];
};

export type StatusResult = WaitingStatus | MatchedStatus;

export type JoinInput = {
  readonly data: AttributeState;
  /**
   * Ordered list of acceptance criteria. Semantically an OR — the
   * participant matches with anyone for whom *some* pair
   * `(myFormula, theirFormula)` mutually accepts the pair. Must be
   * non-empty.
   */
  readonly formulas: readonly DistanceFormula[];
  /**
   * Size of the group this participant wants to be matched into.
   * Default 2 (a head-to-head match). Range: 2..16. The library
   * guarantees a `groupSize: N` participant is only ever placed in a
   * match with N-1 other `groupSize: N` participants, and that every
   * pair within the group mutually accepts each other under the
   * participants' formulas (the "pairwise compatibility" requirement).
   *
   * Use 3+ for team formats, free-for-all queues, party finders, etc.
   * Mixing group sizes within the same partition is safe — participants
   * with different `groupSize` are never candidates for each other.
   */
  readonly groupSize?: number;
  /**
   * Per-participant priority. Higher values are considered before lower
   * values within the same primary bucket; ties fall back to FIFO
   * (`joined_at`). Defaults to 0. Bounded to `[-1000, 1000]`.
   *
   * Use this to surface VIPs, retry-on-failure attempts, or any caller
   * preference that should jump the queue without bypassing the
   * partition/formula constraints.
   */
  readonly priority?: number;
  /**
   * Free-form caller payload that round-trips through `status()`. Stored
   * verbatim as JSONB on the waiting and matched rows. Capped at
   * {@link MATCHMAKING_PAYLOAD_LIMITS}.maxMetadataBytes (1024 bytes of
   * UTF-8 JSON). Use for routing hints, party IDs, custom display
   * data, etc. — the library never reads it.
   */
  readonly metadata?: Record<string, unknown> | null;
};

export type UpdateFormulasResult = {
  readonly updated: boolean;
};

export type JoinResult = {
  readonly participantId: string;
};

export type LeaveResult = {
  readonly removed: boolean;
};

/**
 * Internal: result of a single `Matchmaker.runMatchPass` call. Consumed
 * only by the internal engine; not part of the public API.
 *
 * @internal
 */
export type _MatchPassResult = {
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
 * has it). Use for soft preferences (region, mode, language) where a
 * mismatch is OK if it's the only way to find a match.
 */
export type DistanceFormulaCategoricalTerm = {
  readonly tag: AttributeTag<unknown>;
  readonly penalty: number;
};

/**
 * Hard-equality filter. Two participants are only considered as a candidate
 * pair if they agree on every partition attribute. Unlike a categorical
 * penalty (which the expanding radius eventually absorbs), partition is
 * binary: differ on any partition tag and the pair is never compatible, no
 * matter how long either side waits. Use for any hard partitioning
 * constraint — queue mode, tier, region, bracket, activity kind, etc.
 */
export type DistanceFormulaPartitionTerm = {
  readonly tag: AttributeTag<unknown>;
};

export type DistanceFormula = {
  readonly numeric: readonly DistanceFormulaNumericTerm[];
  readonly categorical?: readonly DistanceFormulaCategoricalTerm[];
  readonly partition?: readonly DistanceFormulaPartitionTerm[];
  /**
   * Optional per-formula expanding-radius override. When set, this
   * formula uses its own `baseRadius / radiusGrowthPerSecond /
   * maxRadius` for the distance check instead of the global
   * `RadiusOptions` passed to {@link Matchmaking}. The OTHER side of
   * the pair still uses whatever radius applies to ITS chosen
   * formula — matching stays asymmetric.
   *
   * Use this for multi-axis queues where different formulas have very
   * different distance scales (e.g. an aggressive "any rating" backup
   * formula alongside a tight ranked-grade formula).
   */
  readonly radius?: RadiusOptions;
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
