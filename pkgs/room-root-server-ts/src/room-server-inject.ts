import { isMessageEnvelope } from '@pkgs/message-shared-ts/message';
import type { CommitArgs } from '@pkgs/room-root-shared-ts/room-server-types';
import type { RoomServiceReceipt } from '@pkgs/room-root-shared-ts/room-service';
import type { RoomStorage } from '@pkgs/room-root-shared-ts/server-core-storage';
import type {
  HandleResult,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';

/** Socket-less work shares ordinary command validation, deduplication and durable commits. */
export async function processInjectedCommand<
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: {
  readonly command: {
    readonly id: string;
    readonly payload: C;
    readonly identity: unknown;
  };
  readonly storage: RoomStorage;
  readonly topic: string;
  readonly now: () => number;
  readonly state: () => RoomState;
  readonly authorize: (command: RoomCommand<C>) => Promise<RoomError | null>;
  readonly handle: (command: RoomCommand<C>) => HandleResult<E>;
  readonly reject: (id: string, error: RoomError) => Promise<void>;
  readonly commit: (commit: CommitArgs<E>) => Promise<void>;
}): Promise<RoomServiceReceipt> {
  const commandId = args.command.id;
  const prior = await args.storage.getDedupOutcome(args.topic, commandId);
  if (prior?.kind === 'rejected') return { ok: false, error: prior.error };
  if (prior?.kind === 'committed') return { ok: true, state: args.state() };
  const command = {
    id: commandId,
    ts: args.now(),
    payload: args.command.payload,
  };
  const denied = isMessageEnvelope(command.payload)
    ? await args.authorize(command)
    : {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'not a valid message envelope',
      };
  if (denied !== null) {
    await args.reject(commandId, denied);
    return { ok: false, error: denied };
  }
  const result = args.handle(command);
  if (!result.ok) {
    await args.reject(commandId, result.error);
    return result;
  }
  await args.commit({
    actor: { id: String(args.command.identity), clientId: 'scheduler' },
    commandId,
    events: result.events,
    effects: result.effects ?? [],
  });
  return { ok: true, state: args.state() };
}
