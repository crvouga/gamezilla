/**
 * Named Tiger Style invariants for the room engine.
 * Mid-chaos checks run every DST step; post-converge checks run at settle.
 *
 * Resource bounds live in {@link ./bounds} (load-time assert).
 */
export const TIGER_INVARIANTS = [
  'log-seq-contiguity',
  'live-vs-log',
  'command-id-dedup-stable',
  'durable-queue-matches-memory',
  'healed-queue-drained',
  'client-lastseq-equals-server-tip',
] as const;

export type TigerInvariant = (typeof TIGER_INVARIANTS)[number];

/** Mid-chaos: always true even under partitions / offline queues. */
export const TIGER_MID_CHAOS_INVARIANTS = [
  'log-seq-contiguity',
  'live-vs-log',
  'command-id-dedup-stable',
  'durable-queue-matches-memory',
] as const satisfies readonly TigerInvariant[];

/** Post-converge: only after heal + sync. */
export const TIGER_POST_CONVERGE_INVARIANTS = [
  'healed-queue-drained',
  'client-lastseq-equals-server-tip',
] as const satisfies readonly TigerInvariant[];
