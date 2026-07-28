import type { Kv } from '@pkgs/kv/interface';
import {
  Room,
  type RoomCommandPayload,
  type RoomEvent,
  type RoomState,
} from '@pkgs/room';
import {
  KeyValueClientRoomStorage,
  keyValueRoomClientKeywords,
} from '@pkgs/room/client/adapters/storage/key-value';
import { WebSocketRoomTransport } from '@pkgs/room/client/adapters/transport/websocket';

import type { SpaceRoomModule } from '../module/space-module-context';
import { apiUrlToRoomWebSocketUrl } from './space-room-url';

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
};

export type CreateSpaceRoomResult = {
  room: Room<RoomState, RoomCommandPayload, RoomEvent, string>;
  transport: WebSocketRoomTransport;
};

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
  } = params;
  const topic = `space:${spaceId}`;
  const transport = new WebSocketRoomTransport({
    url: async () => {
      const token = await Promise.resolve(getSessionToken());
      return apiUrlToRoomWebSocketUrl({
        apiUrl,
        topic,
        sessionToken: token,
        installId,
        clientId,
      });
    },
  });
  const { committed, queue } = keyValueRoomClientKeywords(spaceId);
  const clientStorage = new KeyValueClientRoomStorage(kv, committed, queue);

  const room = await Room.open({
    topic,
    module,
    storage: clientStorage,
    transport,
    identity: myId,
  });

  return { room, transport };
}
