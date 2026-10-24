import {
  PONG_FRAME,
  type RoomConnection,
} from '@pkgs/room-root-shared-ts/room-server-types';
import {
  type ClientToServerWire,
  parseClientToServerWire,
  ROOM_WIRE_KIND,
} from '@pkgs/room-root-shared-ts/wire';

/** Capture the admitted connection before queued work; ping remains immediate. */
export function routeRoomMessage(
  connection: RoomConnection,
  raw: unknown,
  handlers: {
    readonly sync: (fromSeq: number) => Promise<void>;
    readonly signal: (
      frame: Extract<ClientToServerWire, { kind: 'signal' }>
    ) => Promise<void>;
    readonly command: (
      frame: Extract<ClientToServerWire, { kind: 'command' }>
    ) => Promise<void>;
  }
): Promise<void> {
  const parsed = parseClientToServerWire(raw);
  if (parsed === null) return Promise.resolve();
  switch (parsed.kind) {
    case ROOM_WIRE_KIND.ping:
      connection.send(PONG_FRAME);
      return Promise.resolve();
    case ROOM_WIRE_KIND.sync:
      return handlers.sync(parsed.fromSeq);
    case ROOM_WIRE_KIND.signal:
      return handlers.signal(parsed);
    default:
      return handlers.command(parsed);
  }
}
