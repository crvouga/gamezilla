import type {
  RoomClient,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
import type { CreateId } from '@pkgs/uuid';
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  useContext,
} from 'solid-js';

import { createSpaceOpenRoomsPending } from './space-open-rooms-pending';
import { SpaceOpenSessionStore } from './space-open-session-store';

type SpaceRoom = RoomClient<RoomState, RoomCommandPayload, RoomEvent, string>;

export type SpaceOpenRoomEntry = {
  readonly room: SpaceRoom;
  readonly clientId: string;
};

type SpaceOpenRoomsApi = {
  /** Imperative read (refs). Prefer {@link useSpaceOpenRoomEntry} in render. */
  readonly getEntry: (spaceId: string) => SpaceOpenRoomEntry | null;
  readonly dispatch: (spaceId: string, payload: RoomCommandPayload) => void;
  readonly viewingIds: Accessor<ReadonlySet<string>>;
  readonly view: (spaceId: string) => () => void;
  readonly clientId: (
    spaceId: string,
    installId: string,
    createId: CreateId
  ) => string;
  readonly clearClientId: (spaceId: string, installId: string) => void;
};

const SpaceOpenRoomsContext = createContext<SpaceOpenRoomsApi | null>(null);

const SpaceOpenRoomsEntriesContext = createContext<
  Accessor<ReadonlyMap<string, SpaceOpenRoomEntry>>
>(() => new Map<string, SpaceOpenRoomEntry>());

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

function resolveSpaceId(spaceId: string | Accessor<string>): string {
  return typeof spaceId === 'string' ? spaceId : spaceId();
}

/**
 * Registry + dispatch store without open-session slots. Production mounts
 * this via {@link SpaceOpenRoomsProvider}; tests mount it alone so a registry
 * commit notifies {@link useSpaceOpenRoomEntry} consumers.
 */
export function SpaceOpenRoomsStoreProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [entries, setEntries] = createSignal<
    ReadonlyMap<string, SpaceOpenRoomEntry>
  >(new Map());
  const [views, setViews] = createSignal<ReadonlyMap<string, number>>(
    new Map()
  );
  const changeView = (spaceId: string, difference: number): void => {
    setViews((previous) => {
      const next = new Map(previous);
      const count = (next.get(spaceId) ?? 0) + difference;
      if (count > 0) next.set(spaceId, count);
      else next.delete(spaceId);
      return next;
    });
  };
  const viewingIds = createMemo(() => new Set(views().keys()));
  const pendingRef = { current: createSpaceOpenRoomsPending() };
  const sessionRef: { current: SpaceOpenSessionStore | null } = {
    current: null,
  };

  const setEntry: SpaceOpenRoomsRegistrySetter = (spaceId, entry) => {
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
      // Keep a ref view in sync before flush so concurrent dispatch sees the
      // room even before the signal write settles.
      pendingRef.current.flush(spaceId, (payload) => {
        entry.room.dispatch(payload);
      });
    }
  };

  const clearPending: PendingClearer = (spaceId) => {
    pendingRef.current.clear(spaceId);
  };

  // Stable identity so dispatch consumers do not churn; entries notify via
  // SpaceOpenRoomsEntriesContext instead.
  const api: SpaceOpenRoomsApi = {
    clientId: (spaceId, installId, createId) => {
      sessionRef.current ??= new SpaceOpenSessionStore(createId);
      return sessionRef.current.getOrCreate(spaceId, installId);
    },
    clearClientId: (spaceId, installId) =>
      sessionRef.current?.clear(spaceId, installId),
    viewingIds,
    view: (spaceId) => {
      changeView(spaceId, 1);
      return () => changeView(spaceId, -1);
    },
    getEntry: (spaceId) => entries().get(spaceId) ?? null,
    dispatch: (spaceId, payload) => {
      const entry = entries().get(spaceId);
      if (entry !== undefined) {
        entry.room.dispatch(payload);
        return;
      }
      // Local Room still opening — queue until registry commit.
      pendingRef.current.enqueue(spaceId, payload);
    },
  };

  return (
    <SpaceOpenRoomsPendingClearContext.Provider value={clearPending}>
      <SpaceOpenRoomsRegistryContext.Provider value={setEntry}>
        <SpaceOpenRoomsEntriesContext.Provider value={entries}>
          <SpaceOpenRoomsContext.Provider value={api}>
            {props.children}
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
  spaceId: string | Accessor<string>
): Accessor<SpaceOpenRoomEntry | null> {
  // Read from the entries signal (not the stable dispatch API) so a Room
  // commit notifies detail UI.
  const entries = useContext(SpaceOpenRoomsEntriesContext);
  return createMemo(() => entries().get(resolveSpaceId(spaceId)) ?? null);
}
