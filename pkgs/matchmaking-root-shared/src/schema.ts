/**
 * Storage-agnostic schema knobs shared by every matchmaking adapter.
 * Adapters may interpret these differently (SQL hash partitions vs
 * in-memory maps) but the caller-facing shape stays identical.
 */

export type MatchmakingSchema = {
  /**
   * Hard-partitioning keys (e.g. region, mode, time-control). Two
   * participants are never candidates unless they agree on every declared
   * key. Empty array → one global shard.
   */
  readonly partitionKeys?: readonly string[];
  /**
   * The single numeric attribute used to bucket candidates for fast ring
   * queries. When undefined, every row falls into bucket 0.
   */
  readonly primaryNumericKey?: string;
  /**
   * Bucket width on the primary numeric axis. Defaults to 50.
   */
  readonly bucketWidth?: number;
};
