import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { asKeyword } from '@pkgs/keyword';
import { ROOM_ERROR_TYPE } from '../../types';
import { counterSystem } from '../apps/counter/system';
import { counterValue } from '../fixtures/counter-module';

describe('room sim: unknown command reject (E-D04)', () => {
  test('unknown message type rejects without mutate', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = host;
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
