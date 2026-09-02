import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: stale welcome recover (E-C02)', () => {
  test('soft disconnect storms + tip inject still converge', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = host;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    for (let i = 0; i < 5; i += 1) {
      a.dispatch(Increment({}));
    }
    await world.drain();

    // Inject a stale tip-only welcome; client should resync.
    b.injectFromServer({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: 99,
      lastSeq: 99,
      entries: [],
    });
    await world.drain();

    await b.disconnect();
    await b.connect();
    await a.disconnect();
    await a.connect();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(5);
    expect(counterValue(a.snapshot())).toBe(5);
    expect(counterValue(b.snapshot())).toBe(5);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
