import { defineSystemKnob, type SystemKnobDef } from '@pkgs/determinism';
import { arbFromKnobDefs } from '@pkgs/determinism/pbt';
import fc from 'fast-check';

export type RoomWorldKnobs = {
  readonly clientCount: number;
  readonly mildFaults: boolean;
};

/** {@link RoomWorldKnobs} as framework knob defs (id + default + arbitrary). */
export const ROOM_SYSTEM_KNOBS: readonly SystemKnobDef[] = [
  defineSystemKnob({
    id: 'clientCount',
    default: 2,
    arb: fc.integer({ min: 2, max: 3 }),
  }),
  defineSystemKnob({ id: 'mildFaults', default: false, arb: fc.boolean() }),
];

/** Knob arbitrary for scripted PBTs that vary topology around a pin. */
export function arbRoomKnobs(): fc.Arbitrary<RoomWorldKnobs> {
  return arbFromKnobDefs(
    ROOM_SYSTEM_KNOBS.map((knob) => ({ id: knob.id, arb: knob.arb }))
  ) as unknown as fc.Arbitrary<RoomWorldKnobs>;
}
