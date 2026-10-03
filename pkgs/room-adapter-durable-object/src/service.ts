import { isMessageEnvelope, isPlainRecord } from '@pkgs/message';
import type { RoomCommandPayload, RoomEvent, RoomState } from '@pkgs/room';
import type { RoomServer } from '@pkgs/room/server';

/** Reached only through the host's private namespace binding. */
export async function handleRoomService<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(
  request: Request,
  server: RoomServer<S, C, E, Identity>,
  control: { identity: Identity; disconnect: (identity: string | null) => void }
): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const input: unknown = await request.json();
  if (!isPlainRecord(input)) return new Response(null, { status: 400 });
  if (input['operation'] === 'read')
    return Response.json(await server.readCommittedState());
  if (
    input['operation'] === 'send' &&
    typeof input['commandId'] === 'string' &&
    input['commandId'].length > 0 &&
    isMessageEnvelope(input['payload'])
  ) {
    await server.injectServiceCommand({
      id: input['commandId'],
      payload: input['payload'] as C,
      identity: control.identity,
    });
    return new Response(null, { status: 204 });
  }
  if (
    input['operation'] === 'erase' &&
    typeof input['identity'] === 'string' &&
    typeof input['replacement'] === 'string' &&
    input['identity'].length > 0 &&
    input['replacement'].length > 0
  ) {
    await server.eraseIdentity({
      identity: input['identity'],
      replacement: input['replacement'],
    });
    control.disconnect(input['identity']);
    return new Response(null, { status: 204 });
  }
  if (
    input['operation'] === 'disconnect' &&
    (input['identity'] === null || typeof input['identity'] === 'string')
  ) {
    server.disconnectActor(input['identity']);
    control.disconnect(input['identity']);
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 400 });
}
