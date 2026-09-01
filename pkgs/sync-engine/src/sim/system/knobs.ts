import fc from 'fast-check';

export type WorldKnobs = {
  readonly rowImageFanout: boolean;
  readonly liveResendOnReconnect: boolean;
  readonly bufferOutboundLive: boolean;
  readonly clientCount: number;
};

export const arbWorldSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export const arbWorldKnobs = (): fc.Arbitrary<WorldKnobs> =>
  fc.record({
    rowImageFanout: fc.boolean(),
    liveResendOnReconnect: fc.boolean(),
    bufferOutboundLive: fc.boolean(),
    clientCount: fc.integer({ min: 2, max: 3 }),
  });
