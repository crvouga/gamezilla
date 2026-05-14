import type { Kv } from '@gamezilla/lib/kv/interface';
import {
  Room,
  type RoomCommandPayload,
  type RoomEvent,
  type RoomState,
} from '@gamezilla/room';
import {
  KeyValueClientRoomStorage,
  keyValueRoomClientKeywords,
} from '@gamezilla/room/client/adapters/storage/key-value';
import { WebSocketRoomTransport } from '@gamezilla/room/client/adapters/transport/websocket';

import type { SpaceRoomModule } from '../module/space-module-context';
import { apiUrlToRoomWebSocketUrl } from './space-room-url';

export type CreateSpaceRoomParams = {
  spaceId: string;
  apiUrl: string;
  /**
   * Composed space {@link RoomModule}, constructed by the composition root
   * via `createSpaceModule([...])`. Threaded in (rather than imported here)
   * so `@gamezilla/spaces` stays game-agnostic.
   */
  module: SpaceRoomModule;
  /**
   * Client {@link Kv} (e.g. `KvPlatform` — localStorage on web, AsyncStorage on
   * native). Must not use `SecureStorage` / expo-secure-store for this blob:
   * room committed log + outbound queue exceed the 2048-byte per-value cap
   * once a handful of entries accumulate.
   */
  kv: Kv;
  /** Actor id (signed-in account or install id); space DO auth + local room handle. */
  myId: string;
  /** Install UUID — required with bearer JWT for `/space/ws` device binding. */
  installId: string;
  sessionToken: string | null;
};

export type CreateSpaceRoomResult = {
  room: Room<RoomState, RoomCommandPayload, RoomEvent, string>;
  transport: WebSocketRoomTransport;
};

export async function createSpaceRoom(
  params: CreateSpaceRoomParams
): Promise<CreateSpaceRoomResult> {
  const { spaceId, apiUrl, module, kv, myId, installId, sessionToken } = params;
  const topic = `space:${spaceId}`;
  const transport = new WebSocketRoomTransport({
    url: apiUrlToRoomWebSocketUrl(apiUrl, topic, sessionToken, installId),
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
