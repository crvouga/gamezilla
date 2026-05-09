import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';
import { SpaceModule } from '@gamezilla/domain/spaces/space-module';
import {
  Room,
  type RoomCommandPayload,
  type RoomEvent,
  type RoomState,
} from '@gamezilla/room';
import { KeyValueClientRoomStorage } from '@gamezilla/room/client/adapters/storage/key-value';
import { WebSocketRoomTransport } from '@gamezilla/room/client/adapters/transport/websocket';

import { apiUrlToRoomWebSocketUrl } from './space-room-url';

export type CreateSpaceRoomParams = {
  spaceId: string;
  apiUrl: string;
  /**
   * Bulk async key-value storage (localStorage on web, AsyncStorage on
   * native). Must NOT be {@link SecureStorage}: room committed log + outbound
   * queue blobs exceed the 2048-byte expo-secure-store cap once a handful of
   * entries accumulate.
   */
  storage: KeyValueStorage;
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
  const { spaceId, apiUrl, storage, myId, installId, sessionToken } = params;
  const topic = `space:${spaceId}`;
  const transport = new WebSocketRoomTransport({
    url: apiUrlToRoomWebSocketUrl(apiUrl, topic, sessionToken, installId),
  });
  const clientStorage = new KeyValueClientRoomStorage(
    storage,
    `room.${spaceId}`
  );

  const room = await Room.open({
    topic,
    module: SpaceModule,
    storage: clientStorage,
    transport,
    identity: myId,
  });

  return { room, transport };
}
