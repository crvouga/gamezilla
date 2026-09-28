import {
  ROOM_WIRE_KIND,
  type RoomCommandPayload,
  WIRE_VERSION,
} from '@pkgs/room';
/** Build a client→server command wire frame for inject/dedup scenarios. */
export function commandWire(args: {
  readonly id: string;
  readonly ts: number;
  readonly payload: RoomCommandPayload;
}): unknown {
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id: args.id,
    ts: args.ts,
    payload: args.payload,
  };
}
