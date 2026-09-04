import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import { addClient, dispatch, logSeq } from '../../sim/scenario';
import { ROOM_ERROR_TYPE } from '../../types';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue } from '../fixtures/counter-module';
import { readClient, readRejection, readServer } from '../scenario/read-state';

describe('room sim: unknown command reject (E-D04)', () => {
  test('unknown message type rejects without mutate', async () => {
    await using s = await counterSystem.script({ seed: 42 });
    await s.apply(addClient, { id: 'alice' });
    await expectConverged(s);

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
    expect(await s.observe(logSeq)).toBe(0);
    expect(counterValue(await readServer(s))).toBe(0);
    expect(counterValue(await readClient(s, 'alice'))).toBe(0);
  });
});
