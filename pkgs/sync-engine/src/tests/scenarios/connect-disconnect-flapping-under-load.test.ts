import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  readLiveNotes,
  setNote,
} from '../apps/acme';

describe('connect disconnect flapping under load', () => {
  test('online/foreground flap under mutation storm still converges', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 1050,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    for (let i = 0; i < 24; i += 1) {
      await a.mutate(setNote, {
        id: `n-${String(i).padStart(2, '0')}`,
        body: `b${i}`,
      });
      if (i % 4 === 0) {
        b.online(false);
        await world.runFor(25);
        b.online(true);
      }
      if (i % 5 === 0) {
        a.foreground(false);
        b.foreground(false);
        await world.runFor(25);
        a.foreground(true);
        b.foreground(true);
      }
      if (i % 6 === 0) {
        a.online(false);
        await world.runFor(25);
        a.online(true);
      }
    }

    a.online(true);
    a.foreground(true);
    b.online(true);
    b.foreground(true);
    await world.assertConverged();
    expect((await readLiveNotes(world.server.db)).length).toBe(24);
    await expectLiveNote(b.db, 'n-00', { body: 'b0' });
    await expectLiveNote(b.db, 'n-23', { body: 'b23' });
  });

  test.each([1051, 1052, 1053])(
    'seed sweep flap + mutate converges (seed=%i)',
    async (seed) => {
      await using world = await openWorld({
        domain: acmeDomainPack,
        seed,
      });
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      for (let i = 0; i < 8; i += 1) {
        await a.mutate(setNote, { id: `n-${seed}-${i}`, body: `x${i}` });
        b.online(i % 2 === 0);
        await world.runFor(10);
        b.online(true);
      }
      await world.assertConverged();
      await expectLiveNote(b.db, `n-${seed}-7`, { body: 'x7' });
    }
  );
});
