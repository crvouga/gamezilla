import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import type { RoomCommandPayload } from '../../types';

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
