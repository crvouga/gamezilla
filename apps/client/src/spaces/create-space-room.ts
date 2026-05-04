import {
  createSessionPeerIdentity,
  loadOrCreateHostRoomSeed,
} from '@gamezilla/client/auth/peer-identity';
import type { SpaceMembershipRole } from '@gamezilla/domain/spaces/space-entities';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
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
  hostRoomPeerId: string;
  hostRoomPublicKey: string;
  phantomPeerId: string;
  phantomPublicKey: string;
  /** Session bearer for `/room/ws` (query param); required when relay enforces auth. */
  sessionToken: string | null;
};

export type CreateSpaceRoomResult = {
  room: Room;
  transport: WebSocketRoomTransport;
  /** Room `peerId` for this tab (guest ephemeral; host = stable host slot id). */
  sessionPeerId: string;
};

function buildGenesisSnapshot(args: {
  hostRoomPeerId: string;
  hostRoomPublicKey: string;
  phantomPeerId: string;
  phantomPublicKey: string;
}): {
  initialMembership: Record<string, number>;
  initialMemberPublicKeys: Record<string, string>;
} {
  return {
    initialMembership: {
      [args.hostRoomPeerId]: 1,
      [args.phantomPeerId]: 0,
    },
    initialMemberPublicKeys: {
      [args.hostRoomPeerId]: args.hostRoomPublicKey,
      [args.phantomPeerId]: args.phantomPublicKey,
    },
  };
}

export async function createSpaceRoom(
  params: CreateSpaceRoomParams
): Promise<CreateSpaceRoomResult> {
  const {
    spaceId,
    role,
    apiUrl,
    storage,
    hostRoomPeerId,
    hostRoomPublicKey,
    phantomPeerId,
    phantomPublicKey,
    sessionToken,
  } = params;

  const roomSecret = sha256Hex(spaceId);
  const topic = `space:${spaceId}`;
  const transport = new WebSocketRoomTransport({
    url: apiUrlToRoomWebSocketUrl(apiUrl, topic, sessionToken),
    topic,
  });
  const persistence = new InMemoryRoomPersistence();

  const hostSeed = await loadOrCreateHostRoomSeed(storage, spaceId);
  const guestIdentity = createSessionPeerIdentity();

  const secretSeed = role === 'host' ? hostSeed : guestIdentity.secretSeed;
  const sessionPeerId = role === 'host' ? hostRoomPeerId : guestIdentity.peerId;

  const { initialMembership, initialMemberPublicKeys } = buildGenesisSnapshot({
    hostRoomPeerId,
    hostRoomPublicKey,
    phantomPeerId,
    phantomPublicKey,
  });

  let didJoinPeer = false;
  const roomRef: { current: Room | null } = { current: null };

  const onSync = (): void => {
    if (role !== 'guest' || didJoinPeer) return;
    const r = roomRef.current;
    if (r === null) return;
    didJoinPeer = true;
    r.dispatch(
      PeerJoin({
        peerId: guestIdentity.peerId,
        trust: 1,
        publicKey: guestIdentity.publicKeyB64,
      })
    );
  };

  transport.onConnect(() => {
    transport.sendPresenceFrame({
      ch: 'presence',
      kind: 'hello',
      peerId: sessionPeerId,
    });
  });

  const room = await Room.create(
    buildSpaceRoomConfig({
      topic,
      roomSecret,
      secretSeed,
      persistence,
      transport,
      role,
      initialMembership,
      initialMemberPublicKeys,
      onSync,
    })
  );
  roomRef.current = room;
  return { room, transport, sessionPeerId };
}
