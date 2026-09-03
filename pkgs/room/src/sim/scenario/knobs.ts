import fc from 'fast-check';

export type RoomKnobs = {
  readonly clientCount: number;
  readonly mildFaults: boolean;
};

export function arbRoomKnobs(): fc.Arbitrary<RoomKnobs> {
  return fc.record({
    clientCount: fc.integer({ min: 2, max: 3 }),
    mildFaults: fc.boolean(),
  });
}

export const arbSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });
