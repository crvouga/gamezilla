import { isMessageEnvelope } from '@pkgs/message-shared-ts/message';
import type {
  CommandFrame,
  CommitArgs,
  RoomConnection,
} from '@pkgs/room-root-shared-ts/room-server-types';
import type { RoomStorage } from '@pkgs/room-root-shared-ts/server-core-storage';
import type {
  HandleResult,
  RoomCommand,
  RoomError,
  RoomEvent,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { refuseConnectionCommand } from './room-server-connections';
import { sendDedupReplay } from './room-server-fanout';
import { sessionDenial } from './session-grant';

/** Already on the room serial chain; admission and dedup precede domain handling. */
export async function processRoomCommand(args: {
  readonly connection: RoomConnection | undefined;
  readonly connections: Map<string, RoomConnection>;
  readonly storage: RoomStorage;
  readonly topic: string;
  readonly parsed: CommandFrame;
  readonly now: () => number;
  readonly view: (
    connection: RoomConnection
  ) => Parameters<typeof sendDedupReplay>[3];
  readonly authorize: (
    command: RoomCommand,
    grants: readonly string[]
  ) => Promise<RoomError | null>;
  readonly handle: (command: RoomCommand) => HandleResult;
  readonly reject: (
    id: string,
    error: RoomError,
    send: RoomConnection['send']
  ) => Promise<void>;
  readonly commit: (args: CommitArgs<RoomEvent>) => Promise<void>;
}): Promise<void> {
  const conn = args.connection;
  if (conn === undefined) return;
  const send = conn.send;
  const commandId = args.parsed.id;
  if (refuseConnectionCommand(conn, args.connections, commandId)) return;
  const prior = await args.storage.getDedupOutcome(args.topic, commandId);
  if (prior !== null) {
    sendDedupReplay(send, commandId, prior, args.view(conn));
    return;
  }
  if (!isMessageEnvelope(args.parsed.payload)) {
    await args.reject(
      commandId,
      {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'not a valid message envelope',
      },
      send
    );
    return;
  }
  const command: RoomCommand = {
    id: commandId,
    ts: args.now(),
    payload: args.parsed.payload,
  };
  const denied = await args.authorize(command, conn.grants);
  if (refuseConnectionCommand(conn, args.connections, commandId)) return;
  const refusal = sessionDenial(denied, conn.grants, args.now());
  if (refusal !== null) {
    await args.reject(commandId, refusal, send);
    return;
  }
  const result = args.handle(command);
  if (!result.ok) {
    await args.reject(commandId, result.error, send);
    return;
  }
  await args.commit({
    actor: conn.actor,
    commandId,
    events: result.events,
    effects: result.effects ?? [],
  });
}
