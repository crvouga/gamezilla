import { expect, test } from 'bun:test';
import { createRoomService } from '@libs/room-app-shared-ts/create-room-service';
import { localRoomService } from '@libs/room-app-shared-ts/local-room-service';
import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import type { RoomServiceReceipt } from '@pkgs/room-root-shared-ts/room-service';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';

test('a local fixture forwards the authenticated command to the topic owner', async () => {
  const apiOrigin = 'http://127.0.0.1:8787';
  const topic = 'chess-match:alice+bob';
  const receipt: RoomServiceReceipt = { ok: true, state: {} };
  const payload = createMessageNamespace('fixture')(
    'formation',
    (input): input is object => typeof input === 'object'
  )({});
  const service = localRoomService(apiOrigin, 'test-token', async (request) => {
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe(apiOrigin + '/__room-service');
    expect(url.searchParams.get('topic')).toBe(topic);
    expect(url.searchParams.get('module')).toBe('chess-match');
    expect(request.method).toBe('POST');
    expect(request.headers.get('x-room-service-token')).toBe('test-token');
    expect(await request.json()).toEqual({
      operation: 'send',
      commandId: 'formation',
      payload,
    });
    return Response.json(receipt);
  });
  expect(await service.send(topic, 'formation', payload)).toEqual(receipt);
});

test.each(['eraseIdentity', 'disconnect'] as const)(
  'room %s cancels its acknowledgement',
  async (operation) => {
    // regression: worker-http-response-body-leak
    let canceled = false;
    const service = createRoomService({
      idFromName: () => ({}),
      get: () => ({
        fetch: async () =>
          new Response(
            new ReadableStream({
              cancel() {
                canceled = true;
              },
            })
          ),
      }),
    });
    if (operation === 'eraseIdentity')
      await service.eraseIdentity('space:fixture', 'actor-1', 'replacement');
    if (operation === 'disconnect')
      await service.disconnect('space:fixture', 'actor-1');
    expect(canceled).toBe(true);
  }
);

test('room send consumes its receipt body and preserves a domain refusal', async () => {
  const receipt: RoomServiceReceipt = {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.conflict, reason: 'finished' },
  };
  const response = Response.json(receipt);
  const service = createRoomService({
    idFromName: () => ({}),
    get: () => ({ fetch: async () => response }),
  });
  expect(
    await service.send(
      'space:fixture',
      'command-1',
      createMessageNamespace('fixture')(
        'command',
        (payload): payload is object => typeof payload === 'object'
      )({})
    )
  ).toEqual(receipt);
  expect(response.bodyUsed).toBe(true);
});

test('room refusal cancels its body before throwing', async () => {
  let canceled = false;
  const service = createRoomService({
    idFromName: () => ({}),
    get: () => ({
      fetch: async () =>
        new Response(
          new ReadableStream({
            cancel() {
              canceled = true;
            },
          }),
          { status: 503 }
        ),
    }),
  });
  await expect(service.read('space:fixture')).rejects.toThrow(
    'Room service refused 503'
  );
  expect(canceled).toBe(true);
});
