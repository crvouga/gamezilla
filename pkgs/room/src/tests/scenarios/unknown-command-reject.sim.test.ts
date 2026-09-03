import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import { addClient, dispatch, logSeq } from '../../sim/scenario';
import { openRoom } from '../scenario/open-room';
import { ROOM_ERROR_TYPE } from '../../types';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue } from '../fixtures/counter-module';
import { readClient, readRejection, readServer } from '../scenario/read-state';

describe('room sim: unknown command reject (E-D04)', () => {
  test('unknown message type rejects without mutate', async () => {
    await using run = await openRoom(counterSystem);
    await run.apply(addClient, { id: 'alice' });
    await expectConverged(run);

    await run.apply(dispatch, {
      clientId: 'alice',
      payload: {
        type: asKeyword('space-counter-cmd/nope'),
        payload: {},
      },
    });

    expect((await readRejection(run, 'alice'))?.type).toBe(
      ROOM_ERROR_TYPE.invalidCommand
    );
    expect(await run.observe(logSeq)).toBe(0);
    expect(counterValue(await readServer(run))).toBe(0);
    expect(counterValue(await readClient(run, 'alice'))).toBe(0);
  });
});
