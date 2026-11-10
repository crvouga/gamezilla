import { clientConfigTopic } from '@libs/app-config-shared-ts/sync-topics';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import {
  type AppPermission,
  ROLE,
} from '@libs/permissions-shared-ts/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared-ts/permission-policy';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { notifyChannels } from '@pkgs/sync-engine-server-ts/notify-channels';

/** Who the operator role names in each harness, and what it grants them. */
const granted = new WeakMap<
  ProductHarness,
  { readonly accountId: string; readonly permissions: Set<AppPermission> }
>();

/**
 * The signed-in person becomes an operator with these permissions, as an
 * environment's operator allow-list makes them one. Granting the same
 * person more adds to what they already have.
 */
export const grantOperatorPermissions = scenarioAction({
  name: 'grantOperatorPermissions',
  act: async (s, actor: string, permissions: readonly AppPermission[]) => {
    const accountId = await signedInAccountOf(s, actor);
    if (accountId === null)
      throw new Error('An operator needs a normal signed-in account');
    const before = granted.get(s);
    const all = new Set(
      before?.accountId === accountId ? before.permissions : []
    );
    for (const permission of permissions) all.add(permission);
    granted.set(s, { accountId, permissions: all });
    const policy = {
      ...DEFAULT_PERMISSION_POLICY,
      version: 'operator-spec',
      roles: {
        ...DEFAULT_PERMISSION_POLICY.roles,
        [ROLE.syntheticPopulationOperator]: {
          when: { accountId: [accountId] },
          permissions: [...all],
        },
      },
    };
    const db = s.harness.serverSql.sqlClient;
    const now = new Date(s.harness.clock.now()).toISOString();
    await db.run(
      sql`UPDATE client_config SET value = ${JSON.stringify(policy)}, updated_at = ${now} WHERE id = ${'permission_policy'}`
    );
    if (s.harness.server.events !== null)
      await notifyChannels({
        pubsub: s.harness.server.events,
        sql: db,
        tables: ['client_config'],
        topics: [clientConfigTopic()],
        now: s.harness.clock.now,
        label: 'operator-permission-fixture',
      });
    await s.session.waitForIdle();
  },
});
