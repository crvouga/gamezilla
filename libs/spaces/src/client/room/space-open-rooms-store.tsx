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
  useMemo,
  useRef,
  useState,
} from 'react';

import { createSpaceOpenRoomsPending } from './space-open-rooms-pending';

type SpaceRoom = Room<RoomState, RoomCommandPayload, RoomEvent, string>;

export type SpaceOpenRoomEntry = {
  readonly room: SpaceRoom;
  readonly clientId: string;
};

type SpaceOpenRoomsApi = {
  /** Imperative read (refs). Prefer {@link useSpaceOpenRoomEntry} in render. */
  readonly getEntry: (spaceId: string) => SpaceOpenRoomEntry | null;
  readonly dispatch: (spaceId: string, payload: RoomCommandPayload) => void;
};

const SpaceOpenRoomsContext = createContext<SpaceOpenRoomsApi | null>(null);

const SpaceOpenRoomsEntriesContext = createContext<
  ReadonlyMap<string, SpaceOpenRoomEntry>
>(new Map());

export type SpaceOpenRoomsRegistrySetter = (
  spaceId: string,
  entry: SpaceOpenRoomEntry | null
) => void;

const SpaceOpenRoomsRegistryContext =
  createContext<SpaceOpenRoomsRegistrySetter | null>(null);

type PendingClearer = (spaceId: string) => void;

const SpaceOpenRoomsPendingClearContext = createContext<PendingClearer | null>(
  null
);

/**
 * Registry + dispatch store without open-session slots. Production mounts
 * this via {@link SpaceOpenRoomsProvider}; tests mount it alone so a registry
 * commit notifies {@link useSpaceOpenRoomEntry} consumers.
 */
export function SpaceOpenRoomsStoreProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const [entries, setEntries] = useState(
    (): ReadonlyMap<string, SpaceOpenRoomEntry> => new Map()
  );
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const pendingRef = useRef(createSpaceOpenRoomsPending());

  const setEntry = useCallback<SpaceOpenRoomsRegistrySetter>(
    (spaceId, entry) => {
      setEntries((prev) => {
        const current = prev.get(spaceId) ?? null;
        if (entry === null) {
          if (current === null) return prev;
          const next = new Map(prev);
          next.delete(spaceId);
          return next;
        }
        if (
          current?.room === entry.room &&
          current.clientId === entry.clientId
        ) {
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
    },
    []
  );

  const clearPending = useCallback<PendingClearer>((spaceId) => {
    pendingRef.current.clear(spaceId);
  }, []);

  // Stable identity so dispatch consumers do not churn; entries notify via
  // SpaceOpenRoomsEntriesContext instead (React context bailout on equal value).
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
        <SpaceOpenRoomsEntriesContext.Provider value={entries}>
          <SpaceOpenRoomsContext.Provider value={api}>
            {children}
          </SpaceOpenRoomsContext.Provider>
        </SpaceOpenRoomsEntriesContext.Provider>
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

/** Imperative registry commit — for slots and regression tests only. */
export function useSpaceOpenRoomsRegistry(): SpaceOpenRoomsRegistrySetter {
  const setEntry = useContext(SpaceOpenRoomsRegistryContext);
  if (setEntry === null) {
    throw new Error(
      'useSpaceOpenRoomsRegistry: mount SpaceOpenRoomsProvider above this tree'
    );
  }
  return setEntry;
}

export function useSpaceOpenRoomsPendingClear(): PendingClearer | null {
  return useContext(SpaceOpenRoomsPendingClearContext);
}

export function useSpaceOpenRoomEntry(
  spaceId: string
): SpaceOpenRoomEntry | null {
  // Read from entries context (not the stable dispatch API) so a Room commit
  // changes Provider value identity and detail UI re-renders.
  const entries = useContext(SpaceOpenRoomsEntriesContext);
  return entries.get(spaceId) ?? null;
}
