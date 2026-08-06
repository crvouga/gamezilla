/**
 * Nudge payload — smarter poll trigger. `tables` (mutation `writes`) lets the
 * client wake only scopes whose query `hydrates` overlap, avoiding N× refetch
 * when many queries share a topic (e.g. `user:`).
 */
export type NudgePayload = {
  readonly checkpoint?: string;
  /** Domain tables touched by the applied mutation batch (optional). */
  readonly tables?: readonly string[];
};

/** Framework channels context — identity only; product packages may pass a wider object. */
export type QueryChannelsCtx = {
  readonly actorId: string;
  /** Live space ids for room topic subscribe + fanout trust gates. */
  readonly membershipSpaceIds?: readonly string[];
};
