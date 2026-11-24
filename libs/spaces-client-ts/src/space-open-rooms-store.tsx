import { createSpaceOpenRoomsPending } from '@libs/spaces-shared-ts/space-open-rooms-pending';
import { SpaceOpenSessionStore } from '@libs/spaces-shared-ts/space-open-session-store';
import type { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  useContext,
} from 'solid-js';

type SpaceRoom = RoomClient<RoomState, RoomCommandPayload, RoomEvent, string>;

export type SpaceOpenRoomEntry = {
  readonly room: SpaceRoom;
  readonly clientId: string;
  /**
   * Whether this room is still the one its space should have. False from the
   * moment the space's identity changes (a guest becoming its host, …) until
   * the replacement opens: commands issued then wait for the replacement.
   */
  readonly isCurrent: () => boolean;
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

  // The registry as of the latest commit. Imperative readers (dispatch, refs)
  // use it so a command sent right after a commit reaches the room instead
  // of the buffer the commit has already emptied.
  let committed: ReadonlyMap<string, SpaceOpenRoomEntry> = new Map();

  const setEntry: SpaceOpenRoomsRegistrySetter = (spaceId, entry) => {
    const current = committed.get(spaceId) ?? null;
    const unchanged =
      entry === null
        ? current === null
        : current?.room === entry.room && current.clientId === entry.clientId;
    if (!unchanged) {
      const next = new Map(committed);
      if (entry === null) next.delete(spaceId);
      else next.set(spaceId, entry);
      committed = next;
      setEntries(next);
    }
    if (entry?.isCurrent() === true) {
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
    getEntry: (spaceId) => committed.get(spaceId) ?? null,
    dispatch: (spaceId, payload) => {
      const entry = committed.get(spaceId);
      // regression: space-command-lost-to-replaced-room
      if (entry?.isCurrent() === true) {
        entry.room.dispatch(payload);
        return;
      }
      // Local Room still opening or being replaced: queue until the
      // registry commits the room that stays.
      pendingRef.current.enqueue(spaceId, payload);
    },
  };

  return (
    <SpaceOpenRoomsPendingClearContext value={clearPending}>
      <SpaceOpenRoomsRegistryContext value={setEntry}>
        <SpaceOpenRoomsEntriesContext value={entries}>
          <SpaceOpenRoomsContext value={api}>
            {props.children}
          </SpaceOpenRoomsContext>
        </SpaceOpenRoomsEntriesContext>
      </SpaceOpenRoomsRegistryContext>
    </SpaceOpenRoomsPendingClearContext>
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

/** Open local rooms, independently of which detail screen is being viewed. */
export function useSpaceOpenRoomEntries(): Accessor<
  ReadonlyMap<string, SpaceOpenRoomEntry>
> {
  return useContext(SpaceOpenRoomsEntriesContext);
}
