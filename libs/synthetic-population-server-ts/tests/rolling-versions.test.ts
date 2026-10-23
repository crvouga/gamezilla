import { expect, test } from 'bun:test';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

test('overlapping versions and rollback change admission without invalidating existing ownership', async () => {
  const f = await syntheticPopulationFixture(2);
  try {
    const oldWorker = f.workers[0]!;
    const newWorker = f.workers[1]!;
    const oldAssignment = (await f.controller.claim(oldWorker))!;
    await f.heartbeat(newWorker, 'v2');
    const config = await f.repo.config();
    await f.admin.configure(
      { ...config, preferredVersion: 'v2' },
      f.createId()
    );
    expect(await f.controller.claim(oldWorker)).toBeNull();
    const next = (await f.controller.claim(newWorker))!;
    expect(next.lease.userId).not.toBe(oldAssignment.lease.userId);
    expect(await f.sessions.renew(oldAssignment.lease)).not.toBeNull();
    const rollback = await f.repo.config();
    await f.admin.configure(
      { ...rollback, preferredVersion: 'v1' },
      f.createId()
    );
    expect(await f.sessions.renew(next.lease)).not.toBeNull();
    expect(await f.leases.release(next.lease)).toBe(true);
    expect(await f.controller.claim(newWorker)).toBeNull();
    const restored = (await f.controller.claim(oldWorker))!;
    expect(restored.lease.userId).toBe(next.lease.userId);
    expect(restored.lease.generation).toBe(next.lease.generation + 1);
    expect(await f.leases.owned(oldAssignment.lease)).toBe(true);
  } finally {
    await f.db.disconnect();
  }
});

test('successive draining versions and simultaneous expiry retain identities with exclusive generations', async () => {
  const f = await syntheticPopulationFixture(2);
  try {
    const initial = (await f.controller.claim(f.workers[0]!))!;
    let previous = initial;
    for (const version of ['v2', 'v3', 'rollback', 'v4']) {
      f.clock.advance(previous.config.leaseMs + 1);
      const workerId = f.createId();
      await f.heartbeat(workerId, version);
      const replacement = (await f.controller.claim(workerId))!;
      expect(replacement.lease.userId).toBe(initial.lease.userId);
      expect(replacement.personality).toEqual(initial.personality);
      expect(replacement.lease.generation).toBe(previous.lease.generation + 1);
      expect(
        await f.leases.renew(previous.lease, previous.config.leaseMs)
      ).toBeNull();
      expect(await f.leases.release(previous.lease)).toBe(false);
      await f.heartbeat(workerId, version, true);
      expect(await f.controller.claim(workerId)).toBeNull();
      expect(await f.sessions.renew(replacement.lease)).not.toBeNull();
      previous = replacement;
    }
  } finally {
    await f.db.disconnect();
  }
});
