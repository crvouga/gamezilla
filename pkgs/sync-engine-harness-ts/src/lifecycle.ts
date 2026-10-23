import type { LocalDomainSchema } from '@pkgs/sync-engine-client-ts/local-schema-migrate';
import type { MutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { QueryRegistry } from '@pkgs/sync-engine-shared-ts/queries-types';
import type { HarnessClient } from './client';
import type { HarnessPubsubFault } from './edge-fault-pubsub';
import type {
  EdgeFaultController,
  HarnessCrashEvent,
  HarnessHttpFault,
} from './edge-faults';
import type { BootedHarnessKernel } from './types';

export type RestartClientOpts = {
  readonly preserveLocalDb?: boolean;
  readonly schemaEpoch?: number;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly sessionQuery?: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
};

/** True when another live engine still holds the same sqlite handle. */
export function otherClientsShareRawDb(
  clients: ReadonlyMap<string, HarnessClient>,
  id: string
): boolean {
  return peerClientIdsSharingRawDb(clients, id).length > 0;
}

/** Peer engines from addPeerEngine that share the donor sqlite handle. */
export function peerClientIdsSharingRawDb(
  clients: ReadonlyMap<string, HarnessClient>,
  id: string
): readonly string[] {
  const raw = clients.get(id)?.dbBundle.raw;
  if (raw === undefined) return [];
  const peers: string[] = [];
  for (const [otherId, other] of clients) {
    if (otherId === id) continue;
    if (other.dbBundle.raw === raw) peers.push(otherId);
  }
  return peers;
}

export async function crashClientImpl(
  k: BootedHarnessKernel,
  id: string,
  opts?: { readonly keepDb?: boolean }
): Promise<void> {
  const handle = k.clients.get(id);
  if (handle === undefined) throw new Error(`unknown client ${id}`);
  if (opts?.keepDb === true) {
    const meta = k.metas.get(id);
    if (meta !== undefined) meta.lastDbBundle = handle.dbBundle;
  }
  // addPeerEngine shares the donor sqlite; closing it here kills the peer.
  const keepSqlite =
    opts?.keepDb === true || otherClientsShareRawDb(k.clients, id);
  await handle.dispose({ keepDb: keepSqlite });
  k.clients.delete(id);
}

export async function fireCrashIfArmed(
  k: BootedHarnessKernel,
  nodeId: string,
  event: HarnessCrashEvent
): Promise<boolean> {
  if (!k.faults.takeCrash(nodeId, event)) return false;
  if (k.clients.has(nodeId)) {
    await crashClientImpl(k, nodeId, { keepDb: true });
  }
  return true;
}

export function wireMutateCrashArm(
  k: BootedHarnessKernel,
  handle: HarnessClient
): HarnessClient {
  const baseMutate = handle.mutate.bind(handle);
  return {
    ...handle,
    mutate: async (m, a) => {
      const result = await baseMutate(m, a);
      await fireCrashIfArmed(k, handle.id, 'afterNextMutateResolved');
      return result;
    },
  };
}

export type KitFaultApi = {
  readonly armCrash: (nodeId: string, event: HarnessCrashEvent) => void;
  readonly clearCrashArms: (nodeId?: string) => void;
  readonly armHttpFault: (nodeId: string, fault: HarnessHttpFault) => void;
  readonly clearHttpFaults: (nodeId?: string) => void;
  readonly armPublishFault: (count: number | 'next') => void;
  readonly clearPublishFault: () => void;
  readonly armPubsubFault: (fault: HarnessPubsubFault) => void;
  readonly clearPubsubFaults: () => void;
};

export function kitFaultApi(faults: EdgeFaultController): KitFaultApi {
  return {
    armCrash: (nodeId, event) => faults.armCrash(nodeId, event),
    clearCrashArms: (nodeId) => faults.clearCrashArms(nodeId),
    armHttpFault: (nodeId, fault) => faults.armHttpFault(nodeId, fault),
    clearHttpFaults: (nodeId) => faults.clearHttpFaults(nodeId),
    armPublishFault: (count) => faults.armPublishFault(count),
    clearPublishFault: () => faults.clearPublishFault(),
    armPubsubFault: (fault) => faults.armPubsubFault(fault),
    clearPubsubFaults: () => faults.clearPubsubFaults(),
  };
}
