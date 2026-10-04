import type { RoomCommandPayload } from '@pkgs/room-root-shared/types';

/**
 * Buffers room commands for a space while the local Room is still opening
 * (hydrate in flight). Flushed when the open-rooms registry commits a Room
 * so Games/Chess clicks during Connecting… are not silently dropped.
 */
export type SpaceOpenRoomsPending = {
  readonly enqueue: (spaceId: string, payload: RoomCommandPayload) => void;
  readonly flush: (
    spaceId: string,
    dispatch: (payload: RoomCommandPayload) => void
  ) => void;
  readonly clear: (spaceId: string) => void;
};

export function createSpaceOpenRoomsPending(): SpaceOpenRoomsPending {
  const pending = new Map<string, RoomCommandPayload[]>();
  return {
    enqueue(spaceId, payload) {
      const q = pending.get(spaceId) ?? [];
      q.push(payload);
      pending.set(spaceId, q);
    },
    flush(spaceId, dispatch) {
      const q = pending.get(spaceId);
      if (q === undefined || q.length === 0) return;
      pending.delete(spaceId);
      for (const payload of q) {
        dispatch(payload);
      }
    },
    clear(spaceId) {
      pending.delete(spaceId);
    },
  };
}
