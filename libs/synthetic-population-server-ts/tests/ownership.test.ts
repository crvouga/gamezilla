import { expect, test } from 'bun:test';
import { authorizeSyntheticPopulationSession } from '@libs/synthetic-population-server-ts/session-fencing';
import { reconcileCheckpoint } from '@libs/synthetic-population-shared-ts/config';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import sql from '@pkgs/sql-root-shared-ts/sql';
import fc from 'fast-check';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

test('simultaneous claims admit one exclusive identity within desired capacity', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const claims = await Promise.all(
      f.workers.flatMap((worker) => [
        f.controller.claim(worker),
        f.controller.claim(worker),
      ])
    );
    const assigned = claims.filter((claim) => claim !== null);
    expect(assigned).toHaveLength(1);
    expect(await f.repo.users()).toHaveLength(1);
    expect((await f.admin.overview()).online).toBe(1);
  } finally {
    await f.db.disconnect();
  }
});

test('lease expiry fences sessions, writes, inspection and release before a replacement acts', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const first = (await f.controller.claim(f.workers[0]!))!;
    const accountId = f.createId();
    await f.db.run(
      sql`UPDATE population_users SET account_id = ${accountId} WHERE id = ${first.lease.userId}`
    );
    await authorizeSyntheticPopulationSession({
      db: f.db,
      accountId,
      deviceId: first.deviceId,
      nowMs: f.clock.now(),
    });
    f.clock.advance(first.config.leaseMs);
    expect(await f.leases.renew(first.lease, first.config.leaseMs)).toBeNull();
    await expect(
      authorizeSyntheticPopulationSession({
        db: f.db,
        accountId,
        deviceId: first.deviceId,
        nowMs: f.clock.now(),
      })
    ).rejects.toThrow('expired');
    await f.heartbeat(f.workers[1]!);
    const second = (await f.controller.claim(f.workers[1]!))!;
    expect(second.lease.userId).toBe(first.lease.userId);
    expect(second.lease.generation).toBe(first.lease.generation + 1);
    expect(second.deviceId).not.toBe(first.deviceId);
    expect(second.email).toBe(first.email);
    expect(second.personality).toEqual(first.personality);
    expect(second.registered).toBe(true);
    expect(await f.leases.release(first.lease)).toBe(false);
    expect(
      await f.sessions.checkpoint({
        ...first.lease,
        version: 'v1',
        checkpoint: reconcileCheckpoint(null, f.clock.now(), 'seed'),
        action: 'stale',
        error: null,
      })
    ).toBe(false);
    await expect(
      authorizeSyntheticPopulationSession({
        db: f.db,
        accountId,
        deviceId: first.deviceId,
        nowMs: f.clock.now(),
      })
    ).rejects.toThrow('expired');
    await authorizeSyntheticPopulationSession({
      db: f.db,
      accountId,
      deviceId: second.deviceId,
      nowMs: f.clock.now(),
    });
    expect(await f.leases.owned(second.lease)).toBe(true);
  } finally {
    await f.db.disconnect();
  }
});

test('repeated administrative commands are idempotent and cannot change their subject', async () => {
  const f = await syntheticPopulationFixture(2);
  try {
    const first = (await f.controller.claim(f.workers[0]!))!;
    const second = (await f.controller.claim(f.workers[1]!))!;
    const actorId = f.createId();
    const value = { operationId: f.createId(), command: 'pause' as const };
    expect(await f.admin.command(first.lease.userId, value, actorId)).toBe(
      true
    );
    expect(await f.admin.command(first.lease.userId, value, actorId)).toBe(
      true
    );
    expect(await f.admin.command(second.lease.userId, value, actorId)).toBe(
      false
    );
    expect((await f.sessions.renew(first.lease))?.paused).toBe(true);
    expect((await f.sessions.renew(second.lease))?.paused).toBe(false);
    expect(
      (await f.repo.events(first.lease.userId)).filter(
        (event) => event.event === 'AdministrativeCommand'
      )
    ).toHaveLength(1);
    expect(await f.leases.owned(first.lease)).toBe(true);
  } finally {
    await f.db.disconnect();
  }
});

test('configuration CAS prevents a lost update across replicas', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const config = await f.repo.config();
    const results = await Promise.all([
      f.admin.configure({ ...config, desired: 3 }, f.createId()),
      f.admin.configure({ ...config, desired: 8 }, f.createId()),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await f.repo.config()).revision).toBe(config.revision + 1);
  } finally {
    await f.db.disconnect();
  }
});

test('capacity and ownership hold through generated lease replacements', async () => {
  const f = await syntheticPopulationFixture(2);
  try {
    await assertProperty(
      'population ownership',
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 2 }), {
          minLength: 1,
          maxLength: 12,
        }),
        async (operations) => {
          const history = [];
          try {
            for (const operation of operations) {
              if (operation === 2) f.clock.advance(60_000);
              for (const worker of f.workers) await f.heartbeat(worker);
              const assignment = await f.controller.claim(
                f.workers[operation % 2]!
              );
              if (assignment !== null) history.push(assignment);
              const authoritative = await Promise.all(
                history.map(async (entry) =>
                  (await f.leases.owned(entry.lease)) ? entry : null
                )
              );
              const owned = authoritative.filter((entry) => entry !== null);
              expect(owned.length).toBeLessThanOrEqual(2);
              expect(
                new Set(owned.map((entry) => entry.lease.userId)).size
              ).toBe(owned.length);
            }
          } finally {
            for (const entry of history) await f.leases.release(entry.lease);
          }
        }
      )
    );
  } finally {
    await f.db.disconnect();
  }
}, 30_000);
