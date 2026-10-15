import { originAvailabilityFor } from '@libs/app-root-client/origin-availability-for-env';
import type { ProductHarness } from '@libs/harness/harness';
import { visible } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';
import type { NetworkState } from '@pkgs/device-shared/network-state';
import { deviceMemberIdOf } from './identity';

/** The persistent notice beside the app, independent of the current route. */
export function connectionMissing(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.statusConnectionMissing]);
}

/** Port snapshots behind the notice, for an automated failure's diagnostics. */
export async function connectionDiagnostics(s: ProductHarness, actor: string) {
  const client = await s.harness.spawnClient(actor);
  let network: NetworkState | null = null;
  const unsubscribe = client.env.network.subscribe((state) => {
    network = state;
  });
  unsubscribe();
  const identity = await deviceMemberIdOf(s, actor);
  const dbName =
    identity === null
      ? null
      : client.env.resolveDatabaseName({ userId: identity });
  const engine =
    dbName === null ? null : client.syncEnginePool.peekReady(dbName);
  const sync = engine?.status.getSnapshot();
  return {
    network,
    origin: originAvailabilityFor(client.env).getSnapshot().phase,
    sync:
      sync === undefined
        ? null
        : {
            online: sync.online,
            connection: sync.connection,
            hasSynced: sync.hasSynced,
          },
  };
}
