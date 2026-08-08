import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
  writeNoteBody,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('non mutation server write without notify stale until sweep', () => {
  // Domain write outside mutation replay must notify; missed notify ⇒ stale until sweep.
  test('writeNoteBody notify false leaves peers stale until refresh', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1090,
      faults: RELIABLE_FAULTS,
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
    await world.runFor(400);
    await expectLiveNote(world.server.db, 'n1', { body: 'v2-silent' });
    await expectLiveNote(b.db, 'n1', { body: 'v1' });

    // nudge: explicit sweep — missed notify is the footgun under test
    await world.until(b.nudge());
    await expectLiveNote(b.db, 'n1', { body: 'v2-silent' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'v2-silent' });
  });

  test.each([1091, 1092, 1093])(
    'silent write heals on sweep (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
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
      // nudge: heal-by-refetch is the behavior under test
      await world.until(b.nudge());
      // nudge: alice also needs sweep for converge
      await world.until(a.nudge());
      await world.assertConverged();
      await expectLiveNote(b.db, `n-${seed}`, { body: 'new' });
    }
  );
});
