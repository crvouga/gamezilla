import { type DstKnobDef, defineDstKnob } from '@pkgs/dst';
import { arbFromKnobDefs } from '@pkgs/dst/pbt';
import fc from 'fast-check';

export type RoomWorldKnobs = {
  readonly clientCount: number;
  readonly mildFaults: boolean;
};

/** {@link RoomWorldKnobs} as framework knob defs (id + default + arbitrary). */
export const ROOM_DST_KNOBS: readonly DstKnobDef[] = [
  defineDstKnob({
    id: 'clientCount',
    default: 2,
    arb: fc.integer({ min: 2, max: 3 }),
  }),
  defineDstKnob({ id: 'mildFaults', default: false, arb: fc.boolean() }),
];

/** Knob arbitrary for scripted PBTs that vary topology around a pin. */
export function arbRoomKnobs(): fc.Arbitrary<RoomWorldKnobs> {
  return arbFromKnobDefs(
    ROOM_DST_KNOBS.map((knob) => ({ id: knob.id, arb: knob.arb }))
  ) as unknown as fc.Arbitrary<RoomWorldKnobs>;
}
