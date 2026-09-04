import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  serverOp,
  setNote,
  untilAcme,
} from '../apps/acme';
import { expectLiveNoteAt, noteBodyIs } from '../apps/acme/reads';

describe('non mutation server write without notify stale until sweep', () => {
  // Domain write outside mutation replay should notify; missed notify heals
  // via the reconcile tick (safety net), not forever-stale.
  test('writeNoteBody notify false heals via reconcile tick', async () => {
    await using s = await acmeSystem.script({
      seed: 1090,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await expectConverged(s);

    await s.apply(serverOp, 'writeNoteBodySilent', {
      noteId: 'n1',
      body: 'v2-silent',
    });
    await expectLiveNoteAt(s, 'server', 'n1', { body: 'v2-silent' });
    // No notify → no instant wake; reconcile tick heals below.
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'v1' });

    await untilAcme(s, (s) => liveNote(s, 'bob', 'n1'), {
      pred: noteBodyIs('v2-silent'),
    });
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'v2-silent' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'v2-silent' });
  });

  test.each([1091, 1092, 1093])(
    'silent write heals on reconcile tick (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');
      await s.apply(mutate, 'alice', setNote, {
        id: `n-${seed}`,
        body: 'old',
      });
      await expectConverged(s);
      await s.apply(serverOp, 'writeNoteBodySilent', {
        noteId: `n-${seed}`,
        body: 'new',
      });
      await untilAcme(s, (s) => liveNote(s, 'bob', `n-${seed}`), {
        pred: noteBodyIs('new'),
      });
      await expectConverged(s);
      await expectLiveNoteAt(s, 'bob', `n-${seed}`, { body: 'new' });
    }
  );
});
