import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, expect, test } from 'bun:test';
import { expectLiveNote, isLiveNote, setNote } from '../apps/acme';

describe('entry channel wakes never-held row', () => {
  test('world entryChannel delivers peer create before local ever held the row', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 1220,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    // notesWorld entryChannel = NOTES_WORLD_TOPIC (no prior row for n-fresh).
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    expect(await isLiveNote(b.db, 'n-fresh')).toBe(false);

    await a.mutate(setNote, { id: 'n-fresh', body: 'via-entry' });
    await world.assertConverged();

    await expectLiveNote(b.db, 'n-fresh', { body: 'via-entry' });
  });
});
