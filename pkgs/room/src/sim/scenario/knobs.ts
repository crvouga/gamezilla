import { type KnobDef, knob } from '@pkgs/dst';
import { arbSeed } from '@pkgs/dst/pbt';
import fc from 'fast-check';

export type RoomWorldKnobs = {
  readonly clientCount: number;
  readonly mildFaults: boolean;
};

export const CLIENT_COUNT = knob(2, fc.integer({ min: 2, max: 3 }));
export const MILD_FAULTS = knob(false, fc.boolean());

export const ROOM_SYSTEM_KNOBS = {
  clientCount: CLIENT_COUNT,
  mildFaults: MILD_FAULTS,
} as const;

export type RoomKnobDefs = typeof ROOM_SYSTEM_KNOBS;

export { arbSeed };

export function arbRoomKnobs(): fc.Arbitrary<RoomWorldKnobs> {
  return fc.record({
    clientCount: fc.integer({ min: 2, max: 3 }),
    mildFaults: fc.boolean(),
  });
}

export function knobValuesFromCatalog(
  knobGet: <T extends boolean | number>(def: KnobDef<T>) => T
): RoomWorldKnobs {
  return {
    clientCount: knobGet(CLIENT_COUNT),
    mildFaults: knobGet(MILD_FAULTS),
  };
}
