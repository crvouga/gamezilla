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
  selfDeviceId: string
): { room: Room | null; roomRef: MutableRefObject<Room | null> } {
  const [room, setRoom] = useState<Room | null>(null);
  const transportRef = useRef<WebSocketRoomTransport | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    roomRef.current = null;
    setRoom(null);
    if (bootstrap === null) {
      return;
    }

    let cancelled = false;
    transportRef.current = null;

    const run = async (): Promise<void> => {
      const { room: r, transport } = await createSpaceRoom({
        spaceId: bootstrap.spaceId,
        role: bootstrap.role,
        apiUrl: configService.getApiUrl(),
        storage,
        selfDeviceId,
        hostRoomPeerId: bootstrap.hostRoomPeerId,
        hostRoomPublicKey: bootstrap.hostRoomPublicKey,
        phantomPeerId: bootstrap.phantomPeerId,
        phantomPublicKey: bootstrap.phantomPublicKey,
      });
      if (cancelled) {
        r.destroy();
        transport.destroy();
        return;
      }
      transportRef.current = transport;
      roomRef.current = r;
      setRoom(r);
    };

    void run();

    return () => {
      cancelled = true;
      const t = transportRef.current;
      const r = roomRef.current;
      roomRef.current = null;
      transportRef.current = null;
      setRoom(null);
      r?.destroy();
      t?.destroy();
    };
  }, [bootstrap, configService, storage, selfDeviceId]);

  return { room, roomRef };
}
