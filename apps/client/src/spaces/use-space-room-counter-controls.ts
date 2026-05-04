import { Decrement, Increment } from '@gamezilla/domain/spaces/counter-room-module';
import type { Room } from '@gamezilla/room';
import { useCallback, useEffect, useState, type MutableRefObject } from 'react';

function readCount(state: { count?: unknown } | null): number {
  if (state === null) return 0;
  const c = state['count'];
  return typeof c === 'number' && Number.isFinite(c) ? c : 0;
}

export function useSpaceRoomCounterControls(
  room: Room | null,
  roomRef: MutableRefObject<Room | null>
): {
  count: number;
  increment: () => void;
  decrement: () => void;
  isSynced: boolean;
} {
  const [, setRenderTick] = useState(0);
  useEffect(() => {
    if (room === null) return;
    return room.subscribe(() => {
      setRenderTick((x) => x + 1);
    });
  }, [room]);
  const count = readCount(room?.getState() ?? null);
  const isSynced = room?.isSynced() ?? false;
  const increment = useCallback(() => {
    const r = roomRef.current;
    if (r === null || !r.isSynced()) return;
    r.dispatch(Increment({}));
  }, [roomRef]);
  const decrement = useCallback(() => {
    const r = roomRef.current;
    if (r === null || !r.isSynced()) return;
    r.dispatch(Decrement({}));
  }, [roomRef]);
  return { count, increment, decrement, isSynced };
}
