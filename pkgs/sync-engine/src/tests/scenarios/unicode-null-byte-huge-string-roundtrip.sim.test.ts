import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

const EMOJI_RTL = 'hello 👋 مرحبا \u202Ertl';
const WITH_NULL = `before\u0000after-${'x'.repeat(32)}`;
const HUGE = `${'🚀'.repeat(50)}${'a'.repeat(100_000)}`;

describe('unicode null byte huge string roundtrip', () => {
  test('emoji RTL null-byte and huge body round-trip across peers', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 990,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'emoji', body: EMOJI_RTL });
    await a.mutate(setNote, { id: 'nullish', body: WITH_NULL });
    await a.mutate(setNote, { id: 'huge', body: HUGE });
    await world.assertConverged();

    await expectLiveNote(b.db, 'emoji', { body: EMOJI_RTL });
    await expectLiveNote(b.db, 'nullish', { body: WITH_NULL });
    await expectLiveNote(b.db, 'huge', { body: HUGE });
    await expectLiveNote(world.server.db, 'huge', { body: HUGE });
    expect(HUGE.length).toBeGreaterThan(100_000);
  });

  test.each([991, 992, 993])(
    'seed sweep unicode bodies hash-stable converge (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.state);
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      const body = `${EMOJI_RTL}-${seed}-\u0000`;
      await a.mutate(setNote, { id: `u-${seed}`, body });
      await world.assertConverged();
      await expectLiveNote(b.db, `u-${seed}`, { body });
    }
  );
});
