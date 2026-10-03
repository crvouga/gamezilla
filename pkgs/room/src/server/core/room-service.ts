import type { Message } from '@pkgs/message';
import type { RoomState } from '../../types';

/** An injected service binding to authoritative rooms, never a client API. */
export type RoomServicePort = {
  read(topic: string): Promise<RoomState>;
  send(topic: string, commandId: string, payload: Message): Promise<void>;
  disconnect(topic: string, identity: string | null): Promise<void>;
  eraseIdentity(
    topic: string,
    identity: string,
    replacement: string
  ): Promise<void>;
};

export type RoomIdentityErasure = {
  readonly identity: string;
  readonly replacement: string;
};

/** Replace opaque identifiers in keys and values without discarding game records. */
export function eraseRoomIdentity<T>(
  value: T,
  erasure: RoomIdentityErasure
): T {
  if (erasure.identity.length === 0 || erasure.replacement.length === 0)
    throw new Error('empty identity erasure');
  return rewrite(value, erasure) as T;
}

function rewrite(value: unknown, erasure: RoomIdentityErasure): unknown {
  const rename = (text: string) =>
    text.split(erasure.identity).join(erasure.replacement);
  if (typeof value === 'string') return rename(value);
  if (Array.isArray(value))
    return value.map((entry) => rewrite(entry, erasure));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      rename(key),
      rewrite(entry, erasure),
    ])
  );
}
