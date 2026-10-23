import { expect, test } from 'bun:test';
import { createRoomService } from '@libs/room-app-shared-ts/create-room-service';
import { createMessageNamespace } from '@pkgs/message-shared-ts/message';

test.each(['send', 'eraseIdentity', 'disconnect'] as const)(
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
    if (operation === 'send')
      await service.send(
        'space:fixture',
        'command-1',
        createMessageNamespace('fixture')(
          'command',
          (payload): payload is object => typeof payload === 'object'
        )({})
      );
    if (operation === 'eraseIdentity')
      await service.eraseIdentity('space:fixture', 'actor-1', 'replacement');
    if (operation === 'disconnect')
      await service.disconnect('space:fixture', 'actor-1');
    expect(canceled).toBe(true);
  }
);

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
