/** @jsxImportSource solid-js */
import {
  type Accessor,
  createContext,
  createMemo,
  type JSX,
  type ParentProps,
  useContext,
} from 'solid-js';

import type {
  LogEntry,
  RoomActor,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-shared/types';
import { createRoomDispatch, createRoomLog, createRoomRoster, createRoomSelector } from './room-signals';
import type { RoomReadable } from './room-signals';

/** Type-erased room client for multi-room registries. */
export type AnyRoomClient = RoomReadable<
  RoomState,
  RoomCommandPayload,
  RoomEvent
>;

export type RoomClientRegistry = ReadonlyMap<string, AnyRoomClient>;

const EMPTY_REGISTRY: RoomClientRegistry = new Map();

const RoomClientsContext = createContext<Accessor<RoomClientRegistry>>(
  () => EMPTY_REGISTRY
);

export type RoomClientsProviderProps = ParentProps<{
  /** Logical room name → open room client. `null` when none are open. */
  readonly rooms: RoomClientRegistry | null;
}>;

/**
 * Supplies named room clients to `useRoomSelector` / `useRoomDispatch`
 * descendants. `rooms` is reactive: swapping the map re-targets every reader.
 */
export function RoomClientsProvider(
  props: RoomClientsProviderProps
): JSX.Element {
  const registry = createMemo<RoomClientRegistry>(
    () => props.rooms ?? EMPTY_REGISTRY
  );
  return (
    <RoomClientsContext.Provider value={registry}>
      {props.children}
    </RoomClientsContext.Provider>
  );
}

function resolveName(roomName: string | Accessor<string>): string {
  return typeof roomName === 'string' ? roomName : roomName();
}

/** The named room, or `null` when unregistered (reactive to both inputs). */
export function useRoomFromRegistry(
  roomName: string | Accessor<string>
): Accessor<AnyRoomClient | null> {
  const registry = useContext(RoomClientsContext);
  return createMemo(() => registry().get(resolveName(roomName)) ?? null);
}

/**
 * Derived state from the named room. Reads an empty `RoomState` when the room
 * is not registered so parsers yield defaults.
 */
export function useRoomSelector<R>(
  roomName: string | Accessor<string>,
  selector: (state: RoomState) => R
): Accessor<R> {
  return createRoomSelector(useRoomFromRegistry(roomName), selector);
}

/** Dispatch a command to the named room; no-op when it is missing. */
export function useRoomDispatch(
  roomName: string | Accessor<string>
): (payload: RoomCommandPayload) => void {
  return createRoomDispatch(useRoomFromRegistry(roomName));
}

/** Committed event log for the named room (empty when unregistered). */
export function useNamedRoomLog(
  roomName: string | Accessor<string>
): Accessor<readonly LogEntry[]> {
  return createRoomLog(useRoomFromRegistry(roomName));
}

/** Live roster for the named room (empty when unregistered). */
export function useNamedRoomRoster(
  roomName: string | Accessor<string>
): Accessor<readonly RoomActor[]> {
  return createRoomRoster(useRoomFromRegistry(roomName));
}
