import type { Message } from '@pkgs/message-shared/message';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import type { RoomState } from '@pkgs/room-root-shared/types';

type RoomNamespace = {
  idFromName(topic: string): object;
  get(id: object): { fetch(request: Request): Promise<Response> };
};

/** The API composition root supplies its private Room namespace binding. */
export function createRoomService(
  namespace: RoomNamespace | undefined
): RoomServicePort {
  const call = async (topic: string, input: object): Promise<Response> => {
    if (namespace === undefined)
      throw new Error('Room service binding is missing');
    const url = new URL('https://room-service/room-service');
    url.searchParams.set('topic', topic);
    url.searchParams.set('module', 'space');
    const response = await namespace.get(namespace.idFromName(topic)).fetch(
      new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    );
    if (!response.ok)
      throw new Error(`Room service refused ${response.status}`);
    return response;
  };
  return {
    async read(topic): Promise<RoomState> {
      return (await (
        await call(topic, { operation: 'read' })
      ).json()) as RoomState;
    },
    async send(topic, commandId, payload: Message) {
      await call(topic, { operation: 'send', commandId, payload });
    },
    async eraseIdentity(topic, identity, replacement) {
      await call(topic, { operation: 'erase', identity, replacement });
    },
    async disconnect(topic, identity) {
      await call(topic, { operation: 'disconnect', identity });
    },
  };
}
