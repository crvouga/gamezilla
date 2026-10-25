import { useConfigService } from '@libs/auth-client-ts/config-service-context';
import { useMyDeviceId, useMyId } from '@libs/auth-client-ts/use-current-user';
import { useGetFreshAuthToken } from '@libs/auth-client-ts/use-fresh-auth-token';
import {
  MATCH_ROOM_MODULE,
  matchRoomGame,
  matchRoomModule,
  matchRoomTopic,
} from '@libs/game-matchmaking-shared-ts/match-room';
import { useCreateRoomTransport } from '@libs/spaces-client-ts/room-transport-factory';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import { useKv } from '@pkgs/kv-root-client-ts/solid';
import type { Message } from '@pkgs/message-shared-ts/message';
import { keyValueRoomClientKeywords } from '@pkgs/room-root-client-ts/keys';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import { createRoomConnectionKey } from '@pkgs/room-root-client-ts/room-connection-key';
import { createRoomSnapshot } from '@pkgs/room-root-client-ts/room-signals';
import { KeyValueClientRoomStorage } from '@pkgs/room-root-client-ts/storage';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import { useCreateId, useRandom } from '@pkgs/uuid-client-ts/solid';
import {
  type Accessor,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';

export type MatchRoomClient = RoomClient<RoomState, Message, Message, string>;

export function useMatchRoom(gameId: Accessor<string | undefined>) {
  const config = useConfigService();
  const myId = useMyId();
  const deviceId = useMyDeviceId();
  const getToken = useGetFreshAuthToken();
  const clock = useClock();
  const timers = useTimers();
  const createId = useCreateId();
  const random = useRandom();
  const kv = useKv();
  const createTransport = useCreateRoomTransport();
  const [room, setRoom] = createSignal<RoomClient<
    RoomState,
    Message,
    Message,
    string
  > | null>(null);
  const connectionKey = createRoomConnectionKey(() => {
    const id = gameId();
    const identity = myId();
    const installId = deviceId();
    return !id || !identity || !installId
      ? null
      : ([
          matchRoomTopic(id),
          identity,
          installId,
          config.getApiUrl(),
        ] as const);
  });
  createEffect(
    on(connectionKey, (key) => {
      if (key === null) return;
      const [topic, identity, installId, apiUrl] = key;
      const transport = createTransport({
        topic,
        module: MATCH_ROOM_MODULE,
        apiUrl,
        identity,
        installId,
        clientId: createId(),
        getSessionToken: getToken,
        clock,
        timers,
        random,
      });
      const keys = keyValueRoomClientKeywords(topic);
      let disposed = false;
      let opened: RoomClient<RoomState, Message, Message, string> | null = null;
      setRoom(null);
      void RoomClient.open({
        topic,
        module: matchRoomModule,
        transport,
        identity,
        storage: new KeyValueClientRoomStorage(kv, keys.committed, keys.queue),
        clock,
        timers,
        createId,
      }).then((value) => {
        opened = value;
        if (disposed) value.destroy();
        else setRoom(value);
      });
      onCleanup(() => {
        disposed = true;
        opened?.destroy();
        transport.destroy();
        setRoom(null);
      });
    })
  );
  const state = createRoomSnapshot(room);
  return {
    game: () => matchRoomGame(state()),
    room,
    /** From a known room until its device-stored state is restored. */
    opening: () => connectionKey() !== null && room() === null,
  };
}
