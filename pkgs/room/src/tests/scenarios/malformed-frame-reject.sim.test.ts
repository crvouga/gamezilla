import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { ROOM_ERROR_TYPE } from '../../types';
import { counterSystem } from '../apps/counter/system';
import { counterValue } from '../fixtures/counter-module';

describe('room sim: malformed frame reject (E-D02)', () => {
  test('non-Message command payload rejects without mutate', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.state);
    const a = await world.addClient({ id: 'alice' });
    await world.assertConverged();
    const before = a.hash();

    a.injectToServer(
      {
        v: 1,
        kind: 'command',
        id: 'bad-1',
        ts: world.clock.now(),
        payload: { not: 'a-message' },
      },
      { direct: true }
    );
    await world.drain();

    const err = a.lastRejection();
    expect(err).not.toBeNull();
    expect(err && 'type' in err ? err.type : null).toBe(
      ROOM_ERROR_TYPE.invalidCommand
    );
    expect(await world.storage.getLastSeq(world.topic)).toBe(0);
    expect(counterValue(await world.serverSnapshot())).toBe(0);
    expect(counterValue(a.snapshot())).toBe(0);
    expect(a.hash()).toBe(before);
  });

  test('unknown wire kind is ignored without mutate', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '43',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.state);
    const a = await world.addClient({ id: 'alice' });
    await world.assertConverged();
    const before = a.hash();
    a.injectToServer({ v: 1, kind: 'nope' }, { direct: true });
    await world.drain();
    expect(await world.storage.getLastSeq(world.topic)).toBe(0);
    expect(counterValue(await world.serverSnapshot())).toBe(0);
    expect(a.hash()).toBe(before);
  });
});
