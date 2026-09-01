import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('interleaved mutate during upload inflight', () => {
  test('mutates while drain in flight join next batch; no loss', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 823,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.disconnect();
    const first = await a.mutate(setNote, { id: 'n1', body: 'first' });
    const second = await a.mutate(setNote, { id: 'n2', body: 'second' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    // Hold sync so the first upload stays in flight while more mutates land.
    using _hold = world.net('alice', 'sync').set('hold');
    await a.connect();
    await world.runFor(50);

    const third = await a.mutate(setNote, { id: 'n3', body: 'third' });
    const fourth = await a.mutate(setNote, { id: 'n1', body: 'first-v2' });
    expect(third.ok && fourth.ok).toBe(true);
    if (!third.ok || !fourth.ok) return;

    _hold.restore();
    await world.until(a.outcome(fourth.mutationId), { budgetMs: 5_000 });
    expect(await a.outcome(fourth.mutationId)).toBe('confirmed');
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'first-v2' });
    await expectLiveNote(b.db, 'n2', { body: 'second' });
    await expectLiveNote(b.db, 'n3', { body: 'third' });
    await expectNotesMatchServer(a.db, world.server.db);
  });
});
