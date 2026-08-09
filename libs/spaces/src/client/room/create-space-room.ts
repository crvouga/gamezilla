import type { Io } from '@pkgs/io';
import type { Kv } from '@pkgs/kv/interface';
import {
  type ClientTransport,
  Room,
  type RoomCommandPayload,
  type RoomEvent,
  type RoomState,
} from '@pkgs/room';
import {
  KeyValueClientRoomStorage,
  keyValueRoomClientKeywords,
} from '@pkgs/room/client/adapters/storage/key-value';

import type { SpaceRoomModule } from '../module/space-module-context';
import {
  type CreateRoomTransport,
  createWebSocketRoomTransport,
} from './room-transport-factory';

export type CreateSpaceRoomParams = {
  spaceId: string;
  apiUrl: string;
  /**
   * Composed space {@link RoomModule}, constructed by the composition root
   * via `createSpaceModule(name, [...])`. Threaded in (rather than imported here)
   * so `@libs/spaces` stays game-agnostic.
   */
  module: SpaceRoomModule;
  /**
   * Client {@link Kv} (e.g. `KvPlatform` — localStorage on web, AsyncStorage on
   * native). Must not use `SecureStorage` / expo-secure-store for this blob:
   * room committed log + outbound queue exceed the 2048-byte per-value cap
   * once a handful of entries accumulate.
   */
  kv: Kv;
  /** Member actor id (`accountId ?? deviceId`); space DO auth + local room handle. */
  myId: string;
  /** Install UUID — required with bearer JWT for `/room` device binding. */
  installId: string;
  /** Per-tab client id for the live roster. */
  clientId: string;
  /**
   * Fresh bearer for `/room?token=` — called on every WebSocket open
   * (including transport reconnects). May be async so the client can
   * refresh a rotated JWT before the socket upgrade.
   */
  getSessionToken: () => string | null | Promise<string | null>;
  /** Injectable I/O bag (required — no wall default). */
  io: Io;
  /** Defaults to WebSocket when omitted (production). */
  createTransport?: CreateRoomTransport;
};

export type CreateSpaceRoomResult = {
  room: Room<RoomState, RoomCommandPayload, RoomEvent, string>;
  transport: ClientTransport;
};

/**
 * Opens a space room client for local-first UI. Returns after local hydrate;
 * the WebSocket may still be connecting (or offline). Callers must register
 * the Room immediately so optimistic commands work while Connecting… shows.
 */
export async function createSpaceRoom(
  params: CreateSpaceRoomParams
): Promise<CreateSpaceRoomResult> {
  const {
    spaceId,
    apiUrl,
    module,
    kv,
    myId,
    installId,
    clientId,
    getSessionToken,
    io,
    createTransport,
  } = params;
  const topic = `space:${spaceId}`;
  const transport = (createTransport ?? createWebSocketRoomTransport)({
    spaceId,
    apiUrl,
    installId,
    clientId,
    getSessionToken,
    timers: io.timers,
    random: io.random,
  });
  const { committed, queue } = keyValueRoomClientKeywords(spaceId);
  const clientStorage = new KeyValueClientRoomStorage(kv, committed, queue);

  // Room.open is offline-first: hydrate + attach, connect in background.
  // Connect failures do not reject — the Room stays usable locally.
  const room = await Room.open({
    topic,
    module,
    storage: clientStorage,
    transport,
    identity: myId,
    clock: io.clock,
    timers: io.timers,
    createId: io.createId,
  });

  return { room, transport };
}
