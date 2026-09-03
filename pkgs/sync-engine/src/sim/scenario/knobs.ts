import fc from 'fast-check';

export type WorldKnobs = {
  readonly rowImageFanout: boolean;
  readonly liveResendOnReconnect: boolean;
  readonly bufferOutboundLive: boolean;
  readonly clientCount: number;
};

/** Default knobs when a scripted test omits a field. */
export const DEFAULT_WORLD_KNOBS: WorldKnobs = {
  rowImageFanout: true,
  liveResendOnReconnect: false,
  bufferOutboundLive: false,
  clientCount: 2,
};

/**
 * Positional system draws for `start` / `check`:
 * `[clientCount, rowImageFanout, liveResendOnReconnect, bufferOutboundLive]`.
 */
export function syncSystemDraws(knobs?: Partial<WorldKnobs>): unknown[] {
  const k = { ...DEFAULT_WORLD_KNOBS, ...knobs };
  return [
    k.clientCount,
    k.rowImageFanout,
    k.liveResendOnReconnect,
    k.bufferOutboundLive,
  ];
}

export const arbSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export function arbKnobs(): fc.Arbitrary<WorldKnobs> {
  return fc.record({
    rowImageFanout: fc.boolean(),
    liveResendOnReconnect: fc.boolean(),
    bufferOutboundLive: fc.boolean(),
    clientCount: fc.integer({ min: 2, max: 3 }),
  });
}
