import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import { ROOM_ERROR_TYPE } from '@pkgs/room';
import {
  addClient,
  counterSystem,
  counterValue,
  dispatch,
  expectInSync,
  logSeq,
  readClient,
  readRejection,
  readServer,
} from '@pkgs/room-sim';

describe('room sim: unknown command reject (E-D04)', () => {
  test('unknown message type rejects without mutate', async () => {
    await using s = await counterSystem.run({ seed: 42 });
    await s.apply(addClient, { id: 'alice' });
    await expectInSync(s);

    await s.apply(dispatch, {
      clientId: 'alice',
      payload: {
        type: asKeyword('space-counter-cmd/nope'),
        payload: {},
      },
    });

    expect((await readRejection(s, 'alice'))?.type).toBe(
      ROOM_ERROR_TYPE.invalidCommand
    );
    expect(await s.read(logSeq)).toBe(0);
    expect(counterValue(await readServer(s))).toBe(0);
    expect(counterValue(await readClient(s, 'alice'))).toBe(0);
  });
});
