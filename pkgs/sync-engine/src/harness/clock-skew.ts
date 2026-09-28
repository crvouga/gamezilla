/** Logical node id for server wall-clock skew (scheduler stays on base clock). */
export const HARNESS_SERVER_NODE_ID = 'server' as const;

export type ClockSkewTable = {
  readonly get: (nodeId: string) => number;
  readonly set: (nodeId: string, skewMs: number) => void;
  readonly nowFor: (nodeId: string, baseNow: number) => number;
};

/** Mutable per-node offsets applied on top of the shared harness clock. */
export function createClockSkewTable(): ClockSkewTable {
  const skews = new Map<string, number>();
  return {
    get: (nodeId) => skews.get(nodeId) ?? 0,
    set: (nodeId, skewMs) => {
      if (!Number.isFinite(skewMs)) {
        throw new Error(`setClockSkew: bad skew ${skewMs}`);
      }
      skews.set(nodeId, skewMs);
    },
    nowFor: (nodeId, baseNow) => baseNow + (skews.get(nodeId) ?? 0),
  };
}
