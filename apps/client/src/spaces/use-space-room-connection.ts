import type { ConfigService } from '@gamezilla/domain/config/config-service';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { Room, WebSocketRoomTransport } from '@gamezilla/room';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';

import { createSpaceRoom } from './create-space-room';
import type { SpaceRoomBootstrap } from './space-room-bootstrap';

type ConnectionSetters = {
  setRoom: (r: Room | null) => void;
  setTransport: (t: WebSocketRoomTransport | null) => void;
  setSessionPeerId: (id: string | null) => void;
  roomRef: MutableRefObject<Room | null>;
  transportRef: MutableRefObject<WebSocketRoomTransport | null>;
};

type ConnectArgs = {
  bootstrap: SpaceRoomBootstrap;
  configService: ConfigService;
  storage: SecureStorage;
  getSessionToken: () => string | null;
  setters: ConnectionSetters;
  isCancelled: () => boolean;
};

async function connectSpaceRoom(args: ConnectArgs): Promise<void> {
  const { bootstrap, configService, storage, getSessionToken, setters } = args;
  const {
    room: r,
    transport: tr,
    sessionPeerId: sid,
  } = await createSpaceRoom({
    spaceId: bootstrap.spaceId,
    role: bootstrap.role,
    apiUrl: configService.getApiUrl(),
    storage,
    hostRoomPeerId: bootstrap.hostRoomPeerId,
    hostRoomPublicKey: bootstrap.hostRoomPublicKey,
    phantomPeerId: bootstrap.phantomPeerId,
    phantomPublicKey: bootstrap.phantomPublicKey,
    sessionToken: getSessionToken(),
  });
  if (args.isCancelled()) {
    r.destroy();
    tr.destroy();
    return;
  }
  setters.transportRef.current = tr;
  setters.roomRef.current = r;
  setters.setRoom(r);
  setters.setTransport(tr);
  setters.setSessionPeerId(sid);
}

function teardownConnection(setters: ConnectionSetters): void {
  const t = setters.transportRef.current;
  const r = setters.roomRef.current;
  setters.roomRef.current = null;
  setters.transportRef.current = null;
  setters.setRoom(null);
  setters.setTransport(null);
  setters.setSessionPeerId(null);
  r?.destroy();
  t?.destroy();
}

export function useSpaceRoomConnection(
  bootstrap: SpaceRoomBootstrap | null,
  configService: ConfigService,
  storage: SecureStorage,
  getSessionToken: () => string | null
): {
  room: Room | null;
  roomRef: MutableRefObject<Room | null>;
  transport: WebSocketRoomTransport | null;
  sessionPeerId: string | null;
} {
  const [room, setRoom] = useState<Room | null>(null);
  const [transport, setTransport] = useState<WebSocketRoomTransport | null>(
    null
  );
  const [sessionPeerId, setSessionPeerId] = useState<string | null>(null);
  const transportRef = useRef<WebSocketRoomTransport | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    const setters: ConnectionSetters = {
      setRoom,
      setTransport,
      setSessionPeerId,
      roomRef,
      transportRef,
    };
    teardownConnection(setters);
    if (bootstrap === null) {
      return;
    }
    let cancelled = false;
    void connectSpaceRoom({
      bootstrap,
      configService,
      storage,
      getSessionToken,
      setters,
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
      teardownConnection(setters);
    };
  }, [bootstrap, configService, storage, getSessionToken]);

  return { room, roomRef, transport, sessionPeerId };
}
