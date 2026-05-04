import type { ConfigService } from '@gamezilla/domain/config/config-service';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { Room, WebSocketRoomTransport } from '@gamezilla/room';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';

import { createSpaceRoom } from './create-space-room';
import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';

export function useSpaceRoomConnection(
  bootstrap: SpaceRoomConnectionBootstrap | null,
  configService: ConfigService,
  storage: SecureStorage,
  getSessionToken: () => string | null
): {
  room: Room<Record<string, unknown>, unknown, unknown, string> | null;
  roomRef: MutableRefObject<Room<Record<string, unknown>, unknown, unknown, string> | null>;
  transport: WebSocketRoomTransport | null;
} {
  const [room, setRoom] = useState<Room<
    Record<string, unknown>,
    unknown,
    unknown,
    string
  > | null>(null);
  const [transport, setTransport] = useState<WebSocketRoomTransport | null>(
    null
  );
  const transportRef = useRef<WebSocketRoomTransport | null>(null);
  const roomRef = useRef<Room<
    Record<string, unknown>,
    unknown,
    unknown,
    string
  > | null>(null);

  useEffect(() => {
    roomRef.current = null;
    setRoom(null);
    transportRef.current = null;
    setTransport(null);
    if (bootstrap === null) {
      return;
    }

    let cancelled = false;

    const run = async (): Promise<void> => {
      const { room: r, transport: tr } = await createSpaceRoom({
        spaceId: bootstrap.spaceId,
        apiUrl: configService.getApiUrl(),
        storage,
        accountId: bootstrap.accountId,
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
      r?.destroy();
      t?.destroy();
    };
  }, [bootstrap, configService, storage, getSessionToken]);

  return { room, roomRef, transport };
}
