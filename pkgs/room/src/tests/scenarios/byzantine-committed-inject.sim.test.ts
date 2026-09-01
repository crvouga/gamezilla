import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import { roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import {
  CounterIncremented,
  counterValue,
  Increment,
} from '../fixtures/counter-module';

describe('room sim: byzantine committed inject (E-D05)', () => {
  test('fake committed on one client heals to server truth', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    a.dispatch(Increment({}));
    await world.drain();

    // Lie to bob with an extra forged committed entry beyond tip.
    b.injectFromServer({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.committed,
      commandId: 'forged',
      entries: [
        {
          seq: 99,
          event: CounterIncremented({}),
          actor: { id: 'eve', clientId: 'eve' },
          ts: world.clock.now(),
        },
      ],
    });
    await world.drain();

    await b.disconnect();
    await b.connect();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(counterValue(b.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
