import {
  CounterRoomAttr,
  Decrement,
  Increment,
} from '@gamezilla/domain/spaces/space-module';
import { useRoomSnapshot, type Room, type RoomSnapshot } from '@gamezilla/room';
import { useCallback, useMemo, type MutableRefObject } from 'react';

type AppRoom = Room<Record<string, unknown>, unknown, unknown, string>;

function readCount(snap: RoomSnapshot<Record<string, unknown>> | null): number {
  if (snap === null) return 0;
  return CounterRoomAttr.count.from(snap.state);
}

export function useSpaceRoomCounterControls(
  room: AppRoom | null,
  roomRef: MutableRefObject<AppRoom | null>
): {
  count: number;
  increment: () => void;
  decrement: () => void;
  isSynced: boolean;
} {
  const snap = useRoomSnapshot(room);
  const increment = useCallback(() => {
    const r = roomRef.current;
    if (r === null) return;
    if (!r.getSnapshot().isSynced) return;
    r.dispatch(Increment({}));
  }, [roomRef]);
  const decrement = useCallback(() => {
    const r = roomRef.current;
    if (r === null) return;
    if (!r.getSnapshot().isSynced) return;
    r.dispatch(Decrement({}));
  }, [roomRef]);
  return useMemo(
    () => ({
      count: readCount(snap),
      isSynced: snap?.isSynced ?? false,
      increment,
      decrement,
    }),
    [snap, increment, decrement]
  );
}
