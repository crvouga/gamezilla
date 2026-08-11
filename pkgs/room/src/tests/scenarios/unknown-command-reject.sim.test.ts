import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import { openRoomSimWorld } from '../../sim/world';
import { ROOM_ERROR_TYPE } from '../../types';
import { counterValue, TestCounterModule } from '../fixtures/counter-module';

describe('room sim: unknown command reject (E-D04)', () => {
  test('unknown message type rejects without mutate', async () => {
    await using world = await openRoomSimWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.assertConverged();

    a.dispatch({
      type: asKeyword('space-counter-cmd/nope'),
      payload: {},
    });
    await world.drain();

    expect(a.lastRejection()?.type).toBe(ROOM_ERROR_TYPE.invalidCommand);
    expect(await world.storage.getLastSeq(world.topic)).toBe(0);
    expect(counterValue(await world.serverSnapshot())).toBe(0);
    expect(counterValue(a.snapshot())).toBe(0);
  });
});
