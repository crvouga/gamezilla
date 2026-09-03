import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  assertConverged,
  liveNote,
  mutate,
  serverOp,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';
import { expectLiveNoteAt, noteBodyIs } from '../apps/acme/reads';

describe('non mutation server write without notify stale until sweep', () => {
  // Domain write outside mutation replay should notify; missed notify heals
  // via the reconcile tick (safety net), not forever-stale.
  test('writeNoteBody notify false heals via reconcile tick', async () => {
    await using run = await start(acmeSystem, {
      seed: 1090,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await run.apply(assertConverged);

    await run.apply(serverOp, 'writeNoteBodySilent', {
      noteId: 'n1',
      body: 'v2-silent',
    });
    await expectLiveNoteAt(run, 'server', 'n1', { body: 'v2-silent' });
    // No notify → no instant wake; reconcile tick heals below.
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'v1' });

    await untilAcme(run, liveNote('bob', 'n1'), {
      pred: noteBodyIs('v2-silent'),
    });
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'v2-silent' });
    await run.apply(assertConverged);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'v2-silent' });
  });

  test.each([1091, 1092, 1093])(
    'silent write heals on reconcile tick (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');
      await run.apply(mutate, 'alice', setNote, {
        id: `n-${seed}`,
        body: 'old',
      });
      await run.apply(assertConverged);
      await run.apply(serverOp, 'writeNoteBodySilent', {
        noteId: `n-${seed}`,
        body: 'new',
      });
      await untilAcme(run, liveNote('bob', `n-${seed}`), {
        pred: noteBodyIs('new'),
      });
      await run.apply(assertConverged);
      await expectLiveNoteAt(run, 'bob', `n-${seed}`, { body: 'new' });
    }
  );
});
