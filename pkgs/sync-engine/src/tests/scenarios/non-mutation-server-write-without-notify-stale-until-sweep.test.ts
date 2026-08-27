import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  acmeDomainPack,
  readLiveNotes,
  setNote,
  writeNoteBody,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('non mutation server write without notify stale until sweep', () => {
  // Domain write outside mutation replay should notify; missed notify heals
  // via the reconcile tick (safety net), not forever-stale.
  test('writeNoteBody notify false heals via reconcile tick', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 1090,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'v1' });
    await world.assertConverged();

    await writeNoteBody(world.server, {
      id: 'n1',
      body: 'v2-silent',
      notify: false,
    });
    await expectLiveNote(world.server.db, 'n1', { body: 'v2-silent' });
    // No notify → no instant wake; reconcile tick heals below.
    await expectLiveNote(b.db, 'n1', { body: 'v1' });

    await world.until(async () =>
      (await readLiveNotes(b.db)).some(
        (n) => n.id === 'n1' && n.body === 'v2-silent'
      )
    );
    await expectLiveNote(b.db, 'n1', { body: 'v2-silent' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'v2-silent' });
  });

  test.each([1091, 1092, 1093])(
    'silent write heals on reconcile tick (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: acmeDomainPack,
        seed,
      });
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: `n-${seed}`, body: 'old' });
      await world.assertConverged();
      await writeNoteBody(world.server, {
        id: `n-${seed}`,
        body: 'new',
        notify: false,
      });
      await world.until(async () =>
        (await readLiveNotes(b.db)).some(
          (n) => n.id === `n-${seed}` && n.body === 'new'
        )
      );
      await world.assertConverged();
      await expectLiveNote(b.db, `n-${seed}`, { body: 'new' });
    }
  );
});
