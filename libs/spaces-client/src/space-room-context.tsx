import { SPACE_ROOM_MODULE_NAME } from '@libs/spaces-shared/space-room-module-name';
import type { AnyRoomClient } from '@pkgs/room-root-client/room-clients-context';
import { RoomClientsProvider } from '@pkgs/room-root-client/room-clients-context';
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js';
import {
  useSpaceOpenRoomEntry,
  useSpaceOpenRooms,
} from './space-open-rooms-store';

export type SpaceRoomProviderProps = {
  readonly spaceId: string | Accessor<string>;
  readonly children: JSX.Element;
};

type SpaceRoomSession = {
  readonly spaceId: string;
  readonly clientId: string | null;
};

const SpaceRoomSessionContext = createContext<SpaceRoomSession | null>(null);

function resolveId(spaceId: string | Accessor<string>): string {
  return typeof spaceId === 'string' ? spaceId : spaceId();
}

/** Per-tab client id for the open space room (stable across reconnects). */
export function useSpaceRoomClientId(): Accessor<string | null> {
  const ctx = useContext(SpaceRoomSessionContext);
  return () => (ctx === null ? null : ctx.clientId);
}

/** Space id for the detail session (null outside {@link SpaceRoomProvider}). */
export function useSpaceRoomSessionId(): Accessor<string | null> {
  const ctx = useContext(SpaceRoomSessionContext);
  return () => (ctx === null ? null : ctx.spaceId);
}

/**
 * Bridges the app-scoped open-space room into {@link SPACE_ROOM_NAME} for
 * detail UI. Does not open or destroy sockets — that is owned by
 * {@link SpaceOpenRoomsProvider}.
 */
export function SpaceRoomProvider(props: SpaceRoomProviderProps): JSX.Element {
  const spaceId = createMemo(() => resolveId(props.spaceId));
  const entry = useSpaceOpenRoomEntry(spaceId);
  const rooms = useSpaceOpenRooms();
  createEffect(() => {
    onCleanup(rooms.view(spaceId()));
  });
  const roomMap = createMemo((): ReadonlyMap<string, AnyRoomClient> | null => {
    const current = entry();
    if (current === null) return null;
    const m = new Map<string, AnyRoomClient>();
    m.set(SPACE_ROOM_MODULE_NAME, current.room as AnyRoomClient);
    return m;
  });
  const session: SpaceRoomSession = {
    get spaceId() {
      return spaceId();
    },
    get clientId() {
      return entry()?.clientId ?? null;
    },
  };
  return (
    <SpaceRoomSessionContext.Provider value={session}>
      <RoomClientsProvider rooms={roomMap()}>
        {props.children}
      </RoomClientsProvider>
    </SpaceRoomSessionContext.Provider>
  );
}
