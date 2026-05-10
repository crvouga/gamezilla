import type { ConfigService } from '@gamezilla/client/config/config-service';
import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';
import type {
  Room,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@gamezilla/room';
import type { WebSocketRoomTransport } from '@gamezilla/room/client/adapters/transport/websocket';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';

import { createSpaceRoom } from './create-space-room';
import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';

type SpaceRoom = Room<RoomState, RoomCommandPayload, RoomEvent, string>;

function normalizeSessionToken(t: string | null): string | null {
  if (typeof t !== 'string') return null;
  const trimmed = t.trim();
  return trimmed.length === 0 ? null : trimmed;
}

type OpenArgs = {
  bootstrap: SpaceRoomConnectionBootstrap;
  token: string | null;
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
      myId: args.bootstrap.myId,
      installId: args.bootstrap.installId,
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
  /** Bearer for `/space/ws`; must be in sync with `sessionTokenAtom` (re-run when it changes). */
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
    if (bootstrap === null) {
      return;
    }
    const hasBearer = token !== null;
    const hasAnon = bootstrap.myId.length > 0;
    if (!hasBearer && !hasAnon) {
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
