import fc from 'fast-check';

export type SyncKnobs = {
  readonly rowImageFanout: boolean;
  readonly liveResendOnReconnect: boolean;
  readonly bufferOutboundLive: boolean;
  readonly clientCount: number;
};

/** Default knobs when a scripted test omits a field. */
export const DEFAULT_SYNC_KNOBS: SyncKnobs = {
  rowImageFanout: true,
  liveResendOnReconnect: false,
  bufferOutboundLive: false,
  clientCount: 2,
};

/**
 * Typed system knobs for `script` / `explore`:
 * `knobs: syncKnobs({ clientCount: 0 })`.
 */
export function syncKnobs(knobs?: Partial<SyncKnobs>): SyncKnobs {
  return { ...DEFAULT_SYNC_KNOBS, ...knobs };
}

export const arbSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export function arbKnobs(): fc.Arbitrary<SyncKnobs> {
  return fc.record({
    rowImageFanout: fc.boolean(),
    liveResendOnReconnect: fc.boolean(),
    bufferOutboundLive: fc.boolean(),
    clientCount: fc.integer({ min: 2, max: 3 }),
  });
}
