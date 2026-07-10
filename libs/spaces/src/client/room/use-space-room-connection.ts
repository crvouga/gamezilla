import type { ConfigService } from '@libs/auth/client/config-service-types';
import type { Kv } from '@pkgs/kv/interface';
import type {
  Room,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
import type { WebSocketRoomTransport } from '@pkgs/room/client/adapters/transport/websocket';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import { createSpaceRoom } from './create-space-room';
import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';
import { useSpaceModule } from '../module/space-module-context';

type SpaceRoom = Room<RoomState, RoomCommandPayload, RoomEvent, string>;

function normalizeSessionToken(t: string | null): string | null {
  if (typeof t !== 'string') return null;
  const trimmed = t.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function destroyRoomPair(args: {
  roomRef: MutableRefObject<SpaceRoom | null>;
  transportRef: MutableRefObject<WebSocketRoomTransport | null>;
  setRoom: Dispatch<SetStateAction<SpaceRoom | null>>;
  setTransport: Dispatch<SetStateAction<WebSocketRoomTransport | null>>;
}): void {
  const room = args.roomRef.current;
  const transport = args.transportRef.current;
  args.roomRef.current = null;
  args.transportRef.current = null;
  args.setRoom(null);
  args.setTransport(null);
  room?.destroy();
  transport?.destroy();
}

function openSpaceRoom(args: {
  bootstrap: SpaceRoomConnectionBootstrap;
  bootstrapKey: string;
  configService: ConfigService;
  kv: Kv;
  module: ReturnType<typeof useSpaceModule>;
  sessionToken: string | null;
  roomRef: MutableRefObject<SpaceRoom | null>;
  transportRef: MutableRefObject<WebSocketRoomTransport | null>;
  setRoom: Dispatch<SetStateAction<SpaceRoom | null>>;
  setTransport: Dispatch<SetStateAction<WebSocketRoomTransport | null>>;
  connectedKeyRef: MutableRefObject<string | null>;
}): () => void {
  let cancelled = false;
  void (async (): Promise<void> => {
    const { room: nextRoom, transport: nextTransport } =
      await createSpaceRoom({
        spaceId: args.bootstrap.spaceId,
        apiUrl: args.configService.getApiUrl(),
        module: args.module,
        kv: args.kv,
        myId: args.bootstrap.myId,
        installId: args.bootstrap.installId,
        sessionToken: args.sessionToken,
      });
    if (cancelled) {
      nextRoom.destroy();
      nextTransport.destroy();
      return;
    }
    const prevRoom = args.roomRef.current;
    const prevTransport = args.transportRef.current;
    args.roomRef.current = nextRoom;
    args.transportRef.current = nextTransport;
    args.connectedKeyRef.current = args.bootstrapKey;
    args.setRoom(nextRoom);
    args.setTransport(nextTransport);
    if (prevRoom !== null && prevRoom !== nextRoom) prevRoom.destroy();
    if (prevTransport !== null && prevTransport !== nextTransport) {
      prevTransport.destroy();
    }
  })();
  return () => {
    cancelled = true;
  };
}

export function useSpaceRoomConnection(
  bootstrap: SpaceRoomConnectionBootstrap | null,
  configService: ConfigService,
  kv: Kv,
  /** Bearer for `/room`; re-run when bearer availability changes, not on JWT rotation. */
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
  const module = useSpaceModule();
  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;
  const connectedKeyRef = useRef<string | null>(null);

  const bootstrapKey =
    bootstrap === null
      ? null
      : `${bootstrap.spaceId}:${bootstrap.myId}:${bootstrap.installId}`;
  const hasBearer = normalizeSessionToken(sessionToken) !== null;

  const tearDown = useCallback(() => {
    connectedKeyRef.current = null;
    destroyRoomPair({ roomRef, transportRef, setRoom, setTransport });
  }, []);

  useEffect(() => {
    if (bootstrapKey !== null) return;
    tearDown();
  }, [bootstrapKey, tearDown]);

  useEffect(() => {
    if (bootstrap === null || bootstrapKey === null) return;
    if (
      connectedKeyRef.current !== null &&
      connectedKeyRef.current !== bootstrapKey
    ) {
      tearDown();
    }

    const token = normalizeSessionToken(sessionTokenRef.current);
    const hasAnon = bootstrap.myId.length > 0;
    if (token === null && !hasAnon) return;

    return openSpaceRoom({
      bootstrap,
      bootstrapKey,
      configService,
      kv,
      module,
      sessionToken: token,
      roomRef,
      transportRef,
      setRoom,
      setTransport,
      connectedKeyRef,
    });
  }, [bootstrap, bootstrapKey, hasBearer, configService, kv, module, tearDown]);

  return { room, roomRef, transport };
}
