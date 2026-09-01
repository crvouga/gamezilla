import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('two client mutual writes converge', () => {
  test('peer sees note after assertConverged', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 3,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'shared' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'shared' });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
  });

  test.each([1, 2, 42, 99])('seed sweep converges (seed=%i)', async (seed) => {
    await using host = await openWorld(acmeSystem, {
      seed: seed,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, {
      id: `n-${seed}`,
      body: `b-${seed}`,
    });
    await b.mutate(setNote, {
      id: `m-${seed}`,
      body: `c-${seed}`,
    });
    await world.assertConverged();
  });
});
