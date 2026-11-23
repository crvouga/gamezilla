import { describe, expect, test } from 'bun:test';
import { readSpaceRoomAdmission } from '@libs/spaces-client-ts/space-room-admission';

// regression: space-unreachable-while-room-reconnects
describe('what the room gateway said about this device', () => {
  test('only the gateway refusing is a refusal', async () => {
    expect(
      await readSpaceRoomAdmission(
        Response.json({ error: 'not in the space' }, { status: 403 })
      )
    ).toEqual({ verdict: 'refused', reason: 'not in the space' });
  });

  test('admitted', async () => {
    expect(
      await readSpaceRoomAdmission(new Response(null, { status: 204 }))
    ).toEqual({ verdict: 'admitted' });
  });

  test.each([401, 404, 500, 502, 503])(
    'status %i leaves the space to be asked about again',
    async (status) => {
      expect(
        await readSpaceRoomAdmission(new Response('nope', { status }))
      ).toEqual({ verdict: 'unknown', reason: `status ${status}` });
    }
  );
});
