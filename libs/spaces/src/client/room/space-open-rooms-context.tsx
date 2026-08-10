import type {
  Room,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useOpenSpaceSessionIds } from '../open-space/use-open-space-session-ids';
import { createSpaceOpenRoomsPending } from './space-open-rooms-pending';
import { clearSpaceOpenSession } from './space-open-session-store';
import { useSpaceRoom } from './use-space-room';

type SpaceRoom = Room<RoomState, RoomCommandPayload, RoomEvent, string>;

export type SpaceOpenRoomEntry = {
  readonly room: SpaceRoom;
  readonly clientId: string;
};

type SpaceOpenRoomsApi = {
  readonly getEntry: (spaceId: string) => SpaceOpenRoomEntry | null;
  readonly dispatch: (spaceId: string, payload: RoomCommandPayload) => void;
};

const SpaceOpenRoomsContext = createContext<SpaceOpenRoomsApi | null>(null);

type RegistrySetter = (
  spaceId: string,
  entry: SpaceOpenRoomEntry | null
) => void;

const SpaceOpenRoomsRegistryContext = createContext<RegistrySetter | null>(
  null
);

type PendingClearer = (spaceId: string) => void;

const SpaceOpenRoomsPendingClearContext = createContext<PendingClearer | null>(
  null
);

function SpaceOpenRoomSlot({ spaceId }: { readonly spaceId: string }): null {
  const setEntry = useContext(SpaceOpenRoomsRegistryContext);
  const clearPending = useContext(SpaceOpenRoomsPendingClearContext);
  const state = useSpaceRoom(spaceId);

  useEffect(() => {
    if (setEntry === null) return;
    if (state.room === null) {
      // Keep any buffered commands — Room may still be hydrating locally.
      setEntry(spaceId, null);
      return;
    }
    setEntry(spaceId, { room: state.room, clientId: state.clientId });
    return () => {
      setEntry(spaceId, null);
    };
  }, [setEntry, spaceId, state.room, state.clientId]);

  useEffect(() => {
    return () => {
      clearPending?.(spaceId);
      clearSpaceOpenSession(spaceId);
    };
  }, [spaceId, clearPending]);

  return null;
}

/**
 * Keeps one room WebSocket alive per locally-open space (Meet-style).
 * Close/minimize does not tear down; leave/end deletes the
 * `spaces_open_sessions` row and unmounts that slot.
 */
export function SpaceOpenRoomsProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const { spaceIds, isLoading } = useOpenSpaceSessionIds();
  const stableIdsRef = useRef<readonly string[]>([]);
  if (!isLoading) {
    stableIdsRef.current = spaceIds;
  }
  // While the open-session query is loading, keep prior ids mounted and also
  // include any ids already present in `spaceIds` so an optimistic create
  // cannot unmount a brand-new room slot (which stuck the event log on
  // "Connecting…" / "Reconnecting…" with no WebSocket).
  const mountedIds = isLoading
    ? Array.from(new Set([...stableIdsRef.current, ...spaceIds]))
    : spaceIds;
  const [entries, setEntries] = useState(
    (): ReadonlyMap<string, SpaceOpenRoomEntry> => new Map()
  );
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const pendingRef = useRef(createSpaceOpenRoomsPending());

  const setEntry = useCallback<RegistrySetter>((spaceId, entry) => {
    setEntries((prev) => {
      const current = prev.get(spaceId) ?? null;
      if (entry === null) {
        if (current === null) return prev;
        const next = new Map(prev);
        next.delete(spaceId);
        return next;
      }
      if (current?.room === entry.room && current.clientId === entry.clientId) {
        return prev;
      }
      const next = new Map(prev);
      next.set(spaceId, entry);
      return next;
    });
    if (entry !== null) {
      // Keep entriesRef in sync before flush so concurrent dispatch sees the room.
      const next = new Map(entriesRef.current);
      next.set(spaceId, entry);
      entriesRef.current = next;
      pendingRef.current.flush(spaceId, (payload) => {
        entry.room.dispatch(payload);
      });
    } else {
      const next = new Map(entriesRef.current);
      next.delete(spaceId);
      entriesRef.current = next;
    }
  }, []);

  const clearPending = useCallback<PendingClearer>((spaceId) => {
    pendingRef.current.clear(spaceId);
  }, []);

  const api = useMemo((): SpaceOpenRoomsApi => {
    return {
      getEntry: (spaceId) => entriesRef.current.get(spaceId) ?? null,
      dispatch: (spaceId, payload) => {
        const entry = entriesRef.current.get(spaceId);
        if (entry !== undefined) {
          entry.room.dispatch(payload);
          return;
        }
        // Local Room still opening — queue until registry commit.
        pendingRef.current.enqueue(spaceId, payload);
      },
    };
  }, []);

  return (
    <SpaceOpenRoomsPendingClearContext.Provider value={clearPending}>
      <SpaceOpenRoomsRegistryContext.Provider value={setEntry}>
        <SpaceOpenRoomsContext.Provider value={api}>
          {mountedIds.map((spaceId) => (
            <SpaceOpenRoomSlot key={spaceId} spaceId={spaceId} />
          ))}
          {children}
        </SpaceOpenRoomsContext.Provider>
      </SpaceOpenRoomsRegistryContext.Provider>
    </SpaceOpenRoomsPendingClearContext.Provider>
  );
}

export function useSpaceOpenRooms(): SpaceOpenRoomsApi {
  const ctx = useContext(SpaceOpenRoomsContext);
  if (ctx === null) {
    throw new Error(
      'useSpaceOpenRooms: mount SpaceOpenRoomsProvider above this tree'
    );
  }
  return ctx;
}

export function useSpaceOpenRoomEntry(
  spaceId: string
): SpaceOpenRoomEntry | null {
  return useSpaceOpenRooms().getEntry(spaceId);
}
