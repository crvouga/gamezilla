import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, test } from 'bun:test';
import { MAX_FANOUT_ROWS } from '@pkgs/sync-engine/shared';

import { expectNotesMatchServer, retouchNotes, setNote } from '../apps/acme';

function noteIds(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `recv-cap-${String(i).padStart(3, '0')}`
  );
}

describe('fanout receive cap on push', () => {
  test('oversized push row images are dropped; refetch converges', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 9402,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    const ids = noteIds(MAX_FANOUT_ROWS + 1);

    for (const id of ids) {
      await a.mutate(setNote, { id, body: 'seed' });
    }
    await world.assertConverged();

    await a.mutate(retouchNotes, { ids, body: 'over-cap' });
    await world.runFor(500);
    await world.assertConverged();
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
