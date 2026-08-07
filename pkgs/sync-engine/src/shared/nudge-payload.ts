/**
 * Nudge payload — smarter poll trigger. `tables` (mutation `writes`) lets the
 * client wake only scopes whose query `hydrates` overlap. Optional `rows` are
 * a lossy optimization (post-replay images); snapshots alone define correctness.
 */
export type NudgePayload = {
  /** Required: strictly monotonic per-topic checkpoint (decimal string). */
  readonly checkpoint: string;
  /**
   * Client-local MQTT hint before server replay. Apply rows without advancing
   * `_topic_applied`; server fanout remains authoritative.
   */
  readonly optimistic?: true;
  /** Domain tables touched by the applied mutation batch (optional). */
  readonly tables?: readonly string[];
  /**
   * Post-replay row images (incl. `_deleted_at`). Omitted when oversized,
   * undeclared `affectedRows`, or `rowImageFanout` is off.
   */
  readonly rows?: Readonly<Record<string, readonly Record<string, unknown>[]>>;
};

/** Framework channels context — identity only; product packages may pass a wider object. */
export type QueryChannelsCtx = {
  readonly actorId: string;
  /** Live space ids for room topic subscribe + fanout trust gates. */
  readonly membershipSpaceIds?: readonly string[];
};
