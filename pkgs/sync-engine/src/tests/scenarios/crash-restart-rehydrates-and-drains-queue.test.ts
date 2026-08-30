import { describe, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import { acmeDomainPack, expectLiveNote, setNote } from '../apps/acme';

describe('crash restart rehydrates and drains queue', () => {
  test('offline queue drains after reconnect', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 40,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    // AppLifecycle offline: requiresOnline gate; upload may still run.
    a.online(false);
    await a.mutate(setNote, { id: 'n1', body: 'queued' });
    await world.runFor(50);

    a.online(true);
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'queued' });
  });

  test('restart after crash rehydrates all live notes', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 41,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'one' });
    await a.mutate(setNote, { id: 'n2', body: 'two' });
    await world.assertConverged();

    await world.node('bob').crash();
    const bob = await world.node('bob').restart();
    await world.assertConverged();
    await expectLiveNote(bob!.db, 'n1', { body: 'one' });
    await expectLiveNote(bob!.db, 'n2', { body: 'two' });
  });
});
