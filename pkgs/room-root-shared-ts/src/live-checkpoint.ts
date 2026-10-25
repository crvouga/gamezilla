import type { Message } from '@pkgs/message-shared-ts/message';
import { isMessageEnvelope } from '@pkgs/message-shared-ts/message';

/** One replaceable recovery value, independently bounded from the event log. */
export const ROOM_LIVE_CHECKPOINT_MAX_BYTES = 1_048_576;
export type RoomLiveCheckpoint = {
  readonly atSeq: number;
  readonly payload: Message;
};

export function roomLiveCheckpoint(
  atSeq: number,
  payload: Message
): RoomLiveCheckpoint {
  if (!Number.isSafeInteger(atSeq) || atSeq < 0 || !isMessageEnvelope(payload))
    throw new Error('invalid room live checkpoint');
  const checkpoint = { atSeq, payload };
  if (
    new TextEncoder().encode(JSON.stringify(checkpoint)).byteLength >
    ROOM_LIVE_CHECKPOINT_MAX_BYTES
  )
    throw new Error('room live checkpoint exceeds its byte limit');
  return structuredClone(checkpoint);
}

/** Corrupt recovery bytes never become an executable command. */
export function parseRoomLiveCheckpoint(
  value: unknown
): RoomLiveCheckpoint | null {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('atSeq' in value) ||
    !('payload' in value) ||
    typeof value.atSeq !== 'number' ||
    !isMessageEnvelope(value.payload)
  )
    return null;
  try {
    return roomLiveCheckpoint(value.atSeq, value.payload);
  } catch {
    return null;
  }
}
