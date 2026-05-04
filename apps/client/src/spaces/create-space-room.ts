import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { CounterModule } from '@gamezilla/domain/spaces/counter-room-module';
import {
  Room,
  SecureClientRoomStorage,
  WebSocketRoomTransport,
} from '@gamezilla/room';

import { apiUrlToRoomWebSocketUrl } from './space-room-url';

export type CreateSpaceRoomParams = {
  spaceId: string;
  apiUrl: string;
  storage: SecureStorage;
  /** Account id for server-side authorization; passed as client `identity` for local handle. */
  accountId: string;
  sessionToken: string | null;
};

export type CreateSpaceRoomResult = {
  room: Room<Record<string, unknown>, unknown, unknown, string>;
  transport: WebSocketRoomTransport;
};

export async function createSpaceRoom(
  params: CreateSpaceRoomParams
): Promise<CreateSpaceRoomResult> {
  const { spaceId, apiUrl, storage, accountId, sessionToken } = params;
  const topic = `space:${spaceId}`;
  const transport = new WebSocketRoomTransport({
    url: apiUrlToRoomWebSocketUrl(apiUrl, topic, sessionToken),
  });
  const clientStorage = new SecureClientRoomStorage(storage, `room:${spaceId}`);

  const room = await Room.open({
    topic,
    module: CounterModule,
    storage: clientStorage,
    transport,
    identity: accountId,
  });

  return { room, transport };
}
