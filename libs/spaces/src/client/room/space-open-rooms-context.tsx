import type {
  Room,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useOpenSpaceIds } from '../open-space/use-open-space-ids';
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

function SpaceOpenRoomSlot({ spaceId }: { readonly spaceId: string }): null {
  const setEntry = useContext(SpaceOpenRoomsRegistryContext);
  const state = useSpaceRoom(spaceId);

  useEffect(() => {
    if (setEntry === null) return;
    if (state.room === null) {
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
      clearSpaceOpenSession(spaceId);
    };
  }, [spaceId]);

  return null;
}

/**
 * Keeps one room WebSocket alive per locally-open space (Meet-style).
 * Close/minimize does not tear down; leave/end removes the space from
 * {@link useOpenSpaceIds} and unmounts that slot.
 */
export function SpaceOpenRoomsProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const { openSpaceIds } = useOpenSpaceIds();
  const [entries, setEntries] = useState(
    (): ReadonlyMap<string, SpaceOpenRoomEntry> => new Map()
  );

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
  }, []);

  const api = useMemo((): SpaceOpenRoomsApi => {
    return {
      getEntry: (spaceId) => entries.get(spaceId) ?? null,
      dispatch: (spaceId, payload) => {
        entries.get(spaceId)?.room.dispatch(payload);
      },
    };
  }, [entries]);

  return (
    <SpaceOpenRoomsRegistryContext.Provider value={setEntry}>
      <SpaceOpenRoomsContext.Provider value={api}>
        {openSpaceIds.map((spaceId) => (
          <SpaceOpenRoomSlot key={spaceId} spaceId={spaceId} />
        ))}
        {children}
      </SpaceOpenRoomsContext.Provider>
    </SpaceOpenRoomsRegistryContext.Provider>
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
