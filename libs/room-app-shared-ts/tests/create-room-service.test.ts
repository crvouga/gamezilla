import { expect, test } from 'bun:test';
import { createRoomService } from '@libs/room-app-shared-ts/create-room-service';
import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import type { RoomServiceReceipt } from '@pkgs/room-root-shared-ts/room-service';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';

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
