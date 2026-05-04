import type { ConfigService } from '@gamezilla/domain/config/config-service';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { Room, WebSocketRoomTransport } from '@gamezilla/room';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';

import { createSpaceRoom } from './create-space-room';
import type { SpaceRoomBootstrap } from './space-room-bootstrap';

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
    roomRef.current = null;
    setRoom(null);
    setTransport(null);
    setSessionPeerId(null);
    if (bootstrap === null) {
      return;
    }

    let cancelled = false;
    transportRef.current = null;

    const run = async (): Promise<void> => {
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
      if (cancelled) {
        r.destroy();
        tr.destroy();
        return;
      }
      transportRef.current = tr;
      roomRef.current = r;
      setRoom(r);
      setTransport(tr);
      setSessionPeerId(sid);
    };

    void run();

    return () => {
      cancelled = true;
      const t = transportRef.current;
      const r = roomRef.current;
      roomRef.current = null;
      transportRef.current = null;
      setRoom(null);
      setTransport(null);
      setSessionPeerId(null);
      r?.destroy();
      t?.destroy();
    };
  }, [bootstrap, configService, storage, getSessionToken]);

  return { room, roomRef, transport, sessionPeerId };
}
