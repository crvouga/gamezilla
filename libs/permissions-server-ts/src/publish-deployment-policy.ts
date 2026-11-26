import { EnsureClientConfigMaterialized } from '@libs/app-config-server-ts/ensure-client-config-materialized';
import { clientConfigChannels } from '@libs/app-config-shared-ts/sync-topics';
import { permissionPolicyForAdmins } from '@libs/permissions-shared-ts/permission-policy';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { notifyChannels } from '@pkgs/sync-engine-server-ts/notify-channels';

/** Publish the release's grants and configured staff roster before the product Worker goes live. */
export async function publishDeploymentPolicy(
  db: SqlClient,
  clock: Clock,
  pubsub: PubSub,
  adminAccountIds: readonly string[]
): Promise<void> {
  const desired = permissionPolicyForAdmins(adminAccountIds);
  const result = await new EnsureClientConfigMaterialized(db, clock).execute({
    kind: 'admin',
    permissionPolicy: desired,
  });
  if (result.updated)
    await notifyChannels({
      pubsub,
      sql: db,
      now: () => clock.now(),
      topics: clientConfigChannels(),
      label: 'deployment-permission-policy',
    });
}
