import { asKeyword } from '@pkgs/keyword';
import {
  Room,
  type RoomCommandPayload,
  type RoomEvent,
  type RoomState,
} from '@pkgs/room';
import { InMemoryClientStorage } from '@pkgs/room/client/adapters/storage/memory';
import { RoomServer } from '@pkgs/room/server';
import { InMemoryRoomStorage } from '@pkgs/room/server/adapters/memory';
import {
  Increment,
  LoopbackRoomTransport,
  TestCounterModule,
} from '@pkgs/room/testkit';
import { useCallback, useEffect, useState } from 'react';

const TOPIC = 'playground';
const COUNT_KEY = asKeyword('counter/count');

export type SimClient = {
  id: string;
  label: string;
  room: Room<RoomState, RoomCommandPayload, RoomEvent, string>;
};

export type RoomSim = {
  topic: string;
  clients: SimClient[];
};

type CounterRoom = SimClient['room'];

async function connectClient(
  server: RoomServer<RoomState, RoomCommandPayload, RoomEvent, string>,
  id: string,
  identity: string
): Promise<CounterRoom> {
  const transport = new LoopbackRoomTransport(server, id, identity);
  server.registerConnection(id, (msg) => transport.deliverToClient(msg));
  return Room.open({
    topic: TOPIC,
    module: TestCounterModule,
    storage: new InMemoryClientStorage(),
    transport,
    identity,
  });
}

export function readSimCount(room: CounterRoom | null): number {
  if (room === null) return 0;
  const n = room.getSnapshot()[COUNT_KEY];
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

export { Increment };

export function useRoomSim(): { sim: RoomSim | null; error: string | null } {
  const [, bump] = useState(0);
  const rerender = useCallback(() => bump((n) => n + 1), []);
  const [sim, setSim] = useState<RoomSim | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const opened: CounterRoom[] = [];

    void (async () => {
      try {
        const server = new RoomServer<
          RoomState,
          RoomCommandPayload,
          RoomEvent,
          string
        >({
          topic: TOPIC,
          module: TestCounterModule,
          storage: new InMemoryRoomStorage(),
        });
        await server.hydrateFromStorage();

        const alice = await connectClient(server, 'c-a', 'alice');
        const bob = await connectClient(server, 'c-b', 'bob');
        opened.push(alice, bob);

        if (cancelled) {
          for (const r of opened) r.destroy();
          return;
        }

        for (const r of opened) r.subscribe(rerender);
        setSim({
          topic: TOPIC,
          clients: [
            { id: 'c-a', label: 'alice', room: alice },
            { id: 'c-b', label: 'bob', room: bob },
          ],
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const r of opened) r.destroy();
      setSim(null);
    };
  }, [rerender]);

  return { sim, error };
}
