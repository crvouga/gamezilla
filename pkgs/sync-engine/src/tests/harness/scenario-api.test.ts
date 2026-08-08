import { describe, expect, test } from 'bun:test';

import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('sim scenario API', () => {
  test('await using + net hold restore', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 2,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    {
      using _hold = world.net('alice', 'sync').set('hold');
      expect(world.network.isHeld('alice', 'sync')).toBe(true);
      const queued = await a.mutate(setNote, { id: 'n1', body: 'x' });
      expect(queued.ok).toBe(true);
      await world.runFor(200);
    }
    expect(world.network.isHeld('alice', 'sync')).toBe(false);
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'x' });
  });

  test('until drives outcome promise', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 3,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    const queued = await a.mutate(setNote, { id: 'n1', body: 'y' });
    expect(queued.ok).toBe(true);
    if (!queued.ok) return;
    const p = a.outcome(queued.mutationId);
    await world.until(p, { budgetMs: 5_000 });
    expect(await p).toBe('confirmed');
  });

  test('assertConverged neutralizes net effects', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 4,
      faults: RELIABLE_FAULTS,
    });
    await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });
    using hold = world.net('bob', 'sync').set('hold');
    expect(world.network.isHeld('bob', 'sync')).toBe(true);
    await world.assertConverged();
    expect(world.network.isHeld('bob', 'sync')).toBe(false);
    hold.restore();
    expect(world.network.isHeld('bob', 'sync')).toBe(false);
  });

  test('skewClock restores prior', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 5,
      faults: RELIABLE_FAULTS,
    });
    await world.addClient({ id: 'alice' });
    const base = world.node('alice').now();
    {
      using _skew = world.node('alice').skewClock(1_000);
      expect(world.node('alice').now()).toBe(base + 1_000);
    }
    expect(world.node('alice').now()).toBe(base);
  });

  test('nested net set restore-prior LIFO', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 6,
      faults: RELIABLE_FAULTS,
    });
    await world.addClient({ id: 'alice' });
    using outer = world.net('alice', 'sync').set('hold');
    using inner = world.net('alice', 'sync').set({
      packetLossProbability: 1,
    });
    expect(world.network.isHeld('alice', 'sync')).toBe(true);
    inner.restore();
    expect(world.network.isHeld('alice', 'sync')).toBe(true);
    outer.restore();
    expect(world.network.isHeld('alice', 'sync')).toBe(false);
  });
});
