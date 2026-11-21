import { expect, test } from 'bun:test';
import { UserObservatory } from '@libs/observatory-server-ts/user-observatory';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { CONFLICT_RETRY_ATTEMPTS } from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import fc from 'fast-check';
import { observatoryFixture } from './observatory-fixture';

const VALUE = { place: 'spaces', activity: 'browsing', game: null } as const;

function conflicting(db: SqlClient, failures: number, code: string) {
  let attempts = 0;
  const client: SqlClient = {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: (query) => db.query(query),
    run: (query) => db.run(query),
    prepare: (query) => db.prepare(query),
    transaction: (body) =>
      db.transaction(async (tx) => {
        attempts += 1;
        const result = await body(tx);
        if (attempts <= failures)
          throw Object.assign(
            new Error('could not serialize access due to concurrent update'),
            { code }
          );
        return result;
      }),
  };
  return { client, attempts: () => attempts };
}

// regression: live-heartbeat-serialization-conflict
test.each(['40001', '40P01'])(
  'heartbeat recovers a %s rollback and publishes presence once',
  async (code) => {
    const f = await observatoryFixture();
    try {
      const race = conflicting(f.db, 2, code);
      const live = new UserObservatory(race.client, f.ports);
      const device = { accountId: f.createId(), deviceId: f.createId() };
      expect(await live.heartbeat(device, VALUE)).toEqual({ watched: false });
      expect(race.attempts()).toBe(3);
      expect(await live.onlineNow('everyone')).toHaveLength(1);
      expect(f.notices()).toEqual(['presence']);
    } finally {
      await f.db.disconnect();
    }
  }
);

test.each([
  ['40001', CONFLICT_RETRY_ATTEMPTS],
  ['XX000', 1],
] as const)(
  'persistent %s failures stay visible after %i attempts',
  async (code, attempts) => {
    const f = await observatoryFixture();
    try {
      const race = conflicting(f.db, CONFLICT_RETRY_ATTEMPTS + 2, code);
      const live = new UserObservatory(race.client, f.ports);
      await expect(
        live.heartbeat(
          { accountId: f.createId(), deviceId: f.createId() },
          VALUE
        )
      ).rejects.toThrow('concurrent update');
      expect(race.attempts()).toBe(attempts);
      expect(await live.onlineNow('everyone')).toEqual([]);
      expect(f.notices()).toEqual([]);
    } finally {
      await f.db.disconnect();
    }
  }
);

test('a notification failure never replays a committed heartbeat', async () => {
  const f = await observatoryFixture();
  try {
    const race = conflicting(f.db, 0, '40001');
    const failure = Object.assign(new Error('notification failed'), {
      code: '40001',
    });
    const live = new UserObservatory(race.client, {
      ...f.ports,
      presenceChanged: async () => {
        throw failure;
      },
    });
    await expect(
      live.heartbeat({ accountId: f.createId(), deviceId: f.createId() }, VALUE)
    ).rejects.toBe(failure);
    expect(race.attempts()).toBe(1);
    expect(await live.onlineNow('everyone')).toHaveLength(1);
  } finally {
    await f.db.disconnect();
  }
});

test('rolled-back heartbeats never leak presence notifications or duplicate sessions', async () => {
  await assertProperty(
    'heartbeat conflict atomicity',
    fc.asyncProperty(
      fc.integer({ min: 0, max: CONFLICT_RETRY_ATTEMPTS + 1 }),
      fc.constantFrom('40001', '40P01', 'XX000'),
      async (failures, code) => {
        const f = await observatoryFixture();
        try {
          const race = conflicting(f.db, failures, code);
          const live = new UserObservatory(race.client, f.ports);
          const succeeds =
            failures === 0 ||
            (code !== 'XX000' && failures < CONFLICT_RETRY_ATTEMPTS);
          const request = live.heartbeat(
            { accountId: f.createId(), deviceId: f.createId() },
            VALUE
          );
          if (succeeds)
            await expect(request).resolves.toEqual({ watched: false });
          else await expect(request).rejects.toThrow('concurrent update');
          expect(await live.onlineNow('everyone')).toHaveLength(
            succeeds ? 1 : 0
          );
          expect(f.notices()).toEqual(succeeds ? ['presence'] : []);
          expect(race.attempts()).toBe(
            code === 'XX000'
              ? 1
              : Math.min(failures + 1, CONFLICT_RETRY_ATTEMPTS)
          );
        } finally {
          await f.db.disconnect();
        }
      }
    )
  );
});
