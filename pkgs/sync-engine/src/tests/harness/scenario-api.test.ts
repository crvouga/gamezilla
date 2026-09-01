import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, isLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('sim scenario API', () => {
  test('await using + net hold restore', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 2,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
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
    await using host = await openWorld(acmeSystem, {
      seed: 3,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const queued = await a.mutate(setNote, { id: 'n1', body: 'y' });
    expect(queued.ok).toBe(true);
    if (!queued.ok) return;
    const p = a.outcome(queued.mutationId);
    await world.until(p, { budgetMs: 5_000 });
    expect(await p).toBe('confirmed');
  });

  test('never holds for negative window', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 7,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    {
      using _hold = world.net('bob', 'sync').set('hold');
      using _live = world.net('bob', 'live').set('down');
      await a.mutate(setNote, { id: 'n-never', body: 'hidden' });
      await world.never(() => isLiveNote(b.db, 'n-never'), { forMs: 300 });
    }
    await world.assertConverged();
    await expectLiveNote(b.db, 'n-never', { body: 'hidden' });
  });

  test('never fails when target becomes true', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 8,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n-seen', body: 'visible' });
    await expect(
      world.never(() => isLiveNote(b.db, 'n-seen'), { forMs: 2_000 })
    ).rejects.toThrow(/never violated/);
  });

  test('assertConverged neutralizes net effects', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 4,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
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
    await using host = await openWorld(acmeSystem, {
      seed: 5,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    await world.addClient({ id: 'alice' });
    const base = world.node('alice').now();
    {
      using _skew = world.node('alice').skewClock(1_000);
      expect(world.node('alice').now()).toBe(base + 1_000);
    }
    expect(world.node('alice').now()).toBe(base);
  });

  test('nested net set restore-prior LIFO', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 6,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
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
