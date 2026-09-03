import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { MAX_FANOUT_ROWS } from '@pkgs/sync-engine/shared';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  passTime,
  retouchNotes,
  setNote,
  syncVirtualHost,
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
    await using run = await start(acmeSystem, {
      seed: 9402,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    const ids = noteIds(MAX_FANOUT_ROWS + 1);

    for (const id of ids) {
      await run.apply(mutate, 'alice', setNote, { id, body: 'seed' });
    }
    await expectConverged(run);

    await run.apply(mutate, 'alice', retouchNotes, { ids, body: 'over-cap' });
    await run.apply(passTime, 500);
    await expectConverged(run);
    await expectNotesAgree(run, 'bob');
  });
});
