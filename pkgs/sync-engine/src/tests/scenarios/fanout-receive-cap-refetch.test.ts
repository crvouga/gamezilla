import { describe, test } from 'bun:test';
import { MAX_FANOUT_ROWS } from '@pkgs/sync-engine/shared';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  retouchNotes,
  setNote,
} from '../apps/acme';
import { expectNotesAgree } from '../apps/acme/reads';

function noteIds(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `recv-cap-${String(i).padStart(3, '0')}`
  );
}

describe('fanout receive cap on push', () => {
  test('oversized push row images are dropped; refetch converges', async () => {
    await using s = await acmeSystem.script({
      seed: 9402,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    const ids = noteIds(MAX_FANOUT_ROWS + 1);

    for (const id of ids) {
      await s.apply(mutate, 'alice', setNote, { id, body: 'seed' });
    }
    await expectConverged(s);

    await s.apply(mutate, 'alice', retouchNotes, { ids, body: 'over-cap' });
    await s.elapse(500);
    await expectConverged(s);
    await expectNotesAgree(s, 'bob');
  });
});
