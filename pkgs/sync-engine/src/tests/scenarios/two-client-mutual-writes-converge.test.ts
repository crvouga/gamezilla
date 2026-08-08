import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

const FIXED_SEEDS = [1, 2, 42, 99] as const;

describe('two client mutual writes converge', () => {
  test('peer sees note after assertConverged', async () => {
    const world = await openSimWorld({ seed: 3, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'n1', body: 'shared' });
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'shared' });
      await expectNotesMatchServer(a.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep converges', async () => {
    for (const seed of FIXED_SEEDS) {
      const world = await openSimWorld({ seed, faults: RELIABLE_FAULTS });
      try {
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
      } finally {
        await world.dispose();
      }
    }
  });
});
