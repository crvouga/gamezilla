import { loadOrCreatePeerIdentity } from '@gamezilla/client/auth/peer-identity';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SpaceMembershipRole } from '@gamezilla/domain/spaces/space-entities';
import {
  InMemoryRoomPersistence,
  Room,
  sha256Hex,
  WebSocketRoomTransport,
} from '@gamezilla/room';
import { PeerJoin } from '@gamezilla/room/system-messages';

import { buildSpaceRoomConfig } from './build-space-room-config';
import { apiUrlToRoomWebSocketUrl } from './space-room-url';

export type CreateSpaceRoomParams = {
  spaceId: string;
  role: SpaceMembershipRole;
  apiUrl: string;
  storage: SecureStorage;
  selfDeviceId: string;
  hostRoomPeerId: string;
  hostRoomPublicKey: string;
  phantomPeerId: string;
  phantomPublicKey: string;
};

export type CreateSpaceRoomResult = {
  room: Room;
  transport: WebSocketRoomTransport;
};

export async function createSpaceRoom(
  params: CreateSpaceRoomParams
): Promise<CreateSpaceRoomResult> {
  const {
    spaceId,
    role,
    apiUrl,
    storage,
    selfDeviceId,
    hostRoomPeerId,
    hostRoomPublicKey,
    phantomPeerId,
    phantomPublicKey,
  } = params;

  const identity = await loadOrCreatePeerIdentity(storage, selfDeviceId);
  const roomSecret = sha256Hex(spaceId);
  const topic = `space:${spaceId}`;
  const transport = new WebSocketRoomTransport({
    url: apiUrlToRoomWebSocketUrl(apiUrl, topic),
    topic,
  });
  const persistence = new InMemoryRoomPersistence();

  const initialMembership: Record<string, number> = {
    [hostRoomPeerId]: 1,
    [phantomPeerId]: 0,
  };
  const initialMemberPublicKeys: Record<string, string> = {
    [hostRoomPeerId]: hostRoomPublicKey,
    [phantomPeerId]: phantomPublicKey,
  };

  let didJoinPeer = false;
  const roomRef: { current: Room | null } = { current: null };

  const onSync = (): void => {
    if (role !== 'guest' || didJoinPeer) return;
    const r = roomRef.current;
    if (r === null) return;
    didJoinPeer = true;
    r.dispatch(
      PeerJoin({
        peerId: identity.peerId,
        trust: 1,
        publicKey: identity.publicKeyB64,
      })
    );
  };

  const room = await Room.create(
    buildSpaceRoomConfig({
      topic,
      roomSecret,
      secretSeed: identity.secretSeed,
      persistence,
      transport,
      role,
      initialMembership,
      initialMemberPublicKeys,
      onSync,
    })
  );
  roomRef.current = room;
  return { room, transport };
}
