import fc from 'fast-check';

export type RoomWorldKnobs = {
  readonly clientCount: number;
  readonly mildFaults: boolean;
};

export const arbWorldSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export const arbWorldKnobs = (): fc.Arbitrary<RoomWorldKnobs> =>
  fc.record({
    clientCount: fc.integer({ min: 2, max: 3 }),
    mildFaults: fc.boolean(),
  });
