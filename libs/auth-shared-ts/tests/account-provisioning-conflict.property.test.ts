import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import sql from '@pkgs/sql-root-shared-ts/sql';
import fc from 'fast-check';
import { provisioningHost } from './account-provisioning-conflict-fixture';

test('retried provisioning commits one account link and one provisioning event', async () => {
  await assertProperty(
    'account-provisioning-conflict-atomicity',
    fc.asyncProperty(
      fc.array(fc.constantFrom('40001', '40P01'), { maxLength: 2 }),
      async (codes) => {
        const host = await provisioningHost(
          codes.map((code) =>
            Object.assign(new Error('transaction conflict'), { code })
          )
        );
        try {
          expect(await host.execute()).toBe(host.userId);
          expect(
            await host.db.query(
              sql<{
                user_id: string;
              }>`SELECT user_id FROM auth_external_accounts`
            )
          ).toEqual([{ user_id: host.userId }]);
          expect(
            await host.db.query(sql<{ id: string }>`SELECT id FROM auth_users`)
          ).toEqual([{ id: host.userId }]);
          expect(
            await host.db.query(
              sql<{ id: string }>`SELECT id FROM outbox_events`
            )
          ).toHaveLength(1);
        } finally {
          await host.db.disconnect();
        }
      }
    )
  );
});
