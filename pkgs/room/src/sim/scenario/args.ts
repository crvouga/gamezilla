import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';

export type RoomArgs = {
  readonly clientCount: number;
  readonly mildFaults: boolean;
};

/** Default `defineSystem` args for every room system. */
export const ROOM_ARGS: RoomArgs = { clientCount: 0, mildFaults: false };

export function arbRoomArgs(): fc.Arbitrary<RoomArgs> {
  return fc.record({
    clientCount: fc.integer({ min: 2, max: 3 }),
    mildFaults: fc.boolean(),
  });
}

/** `defineSystem` draw — one topology per explore episode. */
export const ROOM_DRAW = () => gen(arbRoomArgs());

export const arbSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });
