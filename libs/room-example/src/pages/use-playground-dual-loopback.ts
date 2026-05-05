import { Room, type RoomState } from '@gamezilla/room';
import { InMemoryClientStorage } from '@gamezilla/room/client/adapters/storage/memory';
import { RoomServer } from '@gamezilla/room/server';
import { InMemoryRoomStorage } from '@gamezilla/room/server/adapters/memory';
import {
  Decrement,
  Increment,
  LoopbackRoomTransport,
  TestCounterModule,
} from '@gamezilla/room/testkit';
import { useCallback, useEffect, useState } from 'react';

type CounterRoom = Room<RoomState, unknown, unknown, string>;

function useForceRender(): () => void {
  const [, setN] = useState(0);
  return useCallback(() => setN((x) => x + 1), []);
}

async function openClientOnServer(
  server: RoomServer<RoomState, unknown, unknown, string>,
  connectionId: string,
  identity: string
): Promise<CounterRoom> {
  const transport = new LoopbackRoomTransport(server, connectionId, identity);
  server.registerConnection(connectionId, (msg) => {
    transport.deliverToClient(msg);
  });
  return Room.open({
    topic: 'playground',
    module: TestCounterModule,
    storage: new InMemoryClientStorage(),
    transport,
    identity,
  });
}

export function usePlaygroundDualLoopback(): {
  roomA: CounterRoom | null;
  roomB: CounterRoom | null;
  error: string | null;
} {
  const rerender = useForceRender();
  const [a, setA] = useState<CounterRoom | null>(null);
  const [b, setB] = useState<CounterRoom | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const storage = new InMemoryRoomStorage();
        const server = new RoomServer<RoomState, unknown, unknown, string>({
          topic: 'playground',
          module: TestCounterModule,
          storage,
        });
        await server.hydrateFromStorage();
        const roomA = await openClientOnServer(server, 'c-a', 'alice');
        const roomB = await openClientOnServer(server, 'c-b', 'bob');
        if (cancelled) {
          roomA.destroy();
          roomB.destroy();
          return;
        }
        roomA.subscribe(rerender);
        roomB.subscribe(rerender);
        setA(roomA);
        setB(roomB);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
      setA((r) => {
        r?.destroy();
        return null;
      });
      setB((r) => {
        r?.destroy();
        return null;
      });
    };
  }, [rerender]);

  return { roomA: a, roomB: b, error: err };
}

export function readPlaygroundCount(room: CounterRoom | null): number {
  if (room === null) return 0;
  const c = room.getSnapshot().state['count'];
  return typeof c === 'number' && Number.isFinite(c) ? c : 0;
}

export { Increment, Decrement };
