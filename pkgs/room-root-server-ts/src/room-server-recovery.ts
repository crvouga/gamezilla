import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomStorage } from '@pkgs/room-root-shared-ts/server-core-storage';
import type {
  RoomCommandPayload,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';

/** Recovery is validated by the live module and committed by its normal command path. */
export async function restoreRoomLiveCheckpoint<
  S extends RoomState,
  C extends RoomCommandPayload,
>(args: {
  readonly storage: RoomStorage;
  readonly topic: string;
  readonly state: S;
  readonly lastSeq: number;
  readonly recover: (state: S, payload: Message) => C | null;
  readonly inject: (id: string, payload: C) => Promise<void>;
}): Promise<void> {
  const saved = await args.storage.loadLiveCheckpoint(args.topic);
  if (saved === null || saved.atSeq > args.lastSeq) return;
  const command = args.recover(args.state, saved.payload);
  if (command !== null)
    await args.inject(`live:recover:${args.lastSeq}`, command);
}
