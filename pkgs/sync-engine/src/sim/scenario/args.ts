import fc from 'fast-check';

import type { SimSessionQuery } from '../domain-pack';

/**
 * Typed system args for a sync system. Defaults live on `system.args`; a
 * scripted test overlays a partial (`args: { clientCount: 0 }`).
 */
export type SyncArgs = {
  readonly rowImageFanout: boolean;
  readonly liveResendOnReconnect: boolean;
  readonly bufferOutboundLive: boolean;
  readonly clientCount: number;
  /** Overrides the domain pack's hydration query for this run. */
  readonly sessionQuery?: SimSessionQuery;
};

export const arbSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

/** Per-episode `draw` for explore campaigns. */
export function arbSyncArgs(): fc.Arbitrary<SyncArgs> {
  return fc.record({
    rowImageFanout: fc.boolean(),
    liveResendOnReconnect: fc.boolean(),
    bufferOutboundLive: fc.boolean(),
    clientCount: fc.integer({ min: 2, max: 3 }),
  });
}
