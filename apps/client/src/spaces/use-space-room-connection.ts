import type { ConfigService } from '@gamezilla/domain/config/config-service';
import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';
import type { Room, WebSocketRoomTransport } from '@gamezilla/room';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';

import { createSpaceRoom } from './create-space-room';
import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';

type SpaceRoom = Room<Record<string, unknown>, unknown, unknown, string>;

function normalizeSessionToken(t: string | null): string | null {
  if (typeof t !== 'string') return null;
  const trimmed = t.trim();
  return trimmed.length === 0 ? null : trimmed;
}

type OpenArgs = {
  bootstrap: SpaceRoomConnectionBootstrap;
  token: string;
  configService: ConfigService;
  storage: KeyValueStorage;
  setRoom: (r: SpaceRoom | null) => void;
  setTransport: (t: WebSocketRoomTransport | null) => void;
  roomRef: MutableRefObject<SpaceRoom | null>;
  transportRef: MutableRefObject<WebSocketRoomTransport | null>;
};

function openConnection(args: OpenArgs): () => void {
  let cancelled = false;
  void (async (): Promise<void> => {
    const { room, transport } = await createSpaceRoom({
      spaceId: args.bootstrap.spaceId,
      apiUrl: args.configService.getApiUrl(),
      storage: args.storage,
      accountId: args.bootstrap.accountId,
      sessionToken: args.token,
    });
    if (cancelled) {
      room.destroy();
      transport.destroy();
      return;
    }
    args.transportRef.current = transport;
    args.roomRef.current = room;
    args.setRoom(room);
    args.setTransport(transport);
  })();
  return () => {
    cancelled = true;
  };
}

export function useSpaceRoomConnection(
  bootstrap: SpaceRoomConnectionBootstrap | null,
  configService: ConfigService,
  storage: KeyValueStorage,
  /** Bearer for `/room/ws`; must be in sync with `sessionTokenAtom` (re-run when it changes). */
  sessionToken: string | null
): {
  room: SpaceRoom | null;
  roomRef: MutableRefObject<SpaceRoom | null>;
  transport: WebSocketRoomTransport | null;
} {
  const [room, setRoom] = useState<SpaceRoom | null>(null);
  const [transport, setTransport] = useState<WebSocketRoomTransport | null>(
    null
  );
  const transportRef = useRef<WebSocketRoomTransport | null>(null);
  const roomRef = useRef<SpaceRoom | null>(null);

  useEffect(() => {
    roomRef.current = null;
    setRoom(null);
    transportRef.current = null;
    setTransport(null);
    const token = normalizeSessionToken(sessionToken);
    if (bootstrap === null || token === null) {
      return;
    }
    const cancel = openConnection({
      bootstrap,
      token,
      configService,
      storage,
      setRoom,
      setTransport,
      roomRef,
      transportRef,
    });
    return () => {
      cancel();
      const t = transportRef.current;
      const r = roomRef.current;
      roomRef.current = null;
      transportRef.current = null;
      setRoom(null);
      setTransport(null);
      r?.destroy();
      t?.destroy();
    };
  }, [bootstrap, configService, storage, sessionToken]);

  return { room, roomRef, transport };
}
