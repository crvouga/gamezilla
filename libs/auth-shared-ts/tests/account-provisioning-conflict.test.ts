import { expect, test } from 'bun:test';
import { CONFLICT_RETRY_ATTEMPTS } from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { provisioningHost } from './account-provisioning-conflict-fixture';

const conflict = Object.assign(
  new Error('could not serialize access due to concurrent update'),
  { code: '40001' }
);

// regression: concurrent-account-provisioning-conflict
test('a racing account upgrade reloads the winner instead of refusing authentication', async () => {
  const host = await provisioningHost([conflict], true);
  try {
    expect(await host.execute()).toBe(host.userId);
    expect(host.attempts()).toBe(2);
    expect(
      await host.db.query(
        sql<{ id: string; is_anon: number }>`SELECT id, is_anon FROM auth_users`
      )
    ).toEqual([{ id: host.userId, is_anon: 0 }]);
    expect(
      await host.db.query(
        sql<{ user_id: string }>`SELECT user_id FROM auth_external_accounts`
      )
    ).toEqual([{ user_id: host.userId }]);
    expect(
      await host.db.query(sql<{ id: string }>`SELECT id FROM outbox_events`)
    ).toHaveLength(1);
  } finally {
    await host.db.disconnect();
  }
});

test.each([
  [
    'persistent contention',
    Array.from({ length: CONFLICT_RETRY_ATTEMPTS + 1 }, () => conflict),
    CONFLICT_RETRY_ATTEMPTS,
  ],
  ['an unknown connection failure', [new Error('connection lost')], 1],
])(
  '%s remains a failure without an unbounded retry',
  async (_name, failures, attempts) => {
    const host = await provisioningHost(failures);
    try {
      await expect(host.execute()).rejects.toBe(failures[0]);
      expect(host.attempts()).toBe(attempts);
      expect(
        await host.db.query(
          sql<{ is_anon: number }>`SELECT is_anon FROM auth_users`
        )
      ).toEqual([{ is_anon: 1 }]);
      expect(
        await host.db.query(
          sql<{ user_id: string }>`SELECT user_id FROM auth_external_accounts`
        )
      ).toEqual([]);
    } finally {
      await host.db.disconnect();
    }
  }
);
