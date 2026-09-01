import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type {
  BoundaryFaultController,
  SimCrashEvent,
  SimHttpFault,
  SimPubsubFault,
} from './boundary-faults';
import type { SimClientHandle } from './client-factory';
import type { BootedSimKernel } from './world-types';

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
  clients: ReadonlyMap<string, SimClientHandle>,
  id: string
): boolean {
  const raw = clients.get(id)?.dbBundle.raw;
  if (raw === undefined) return false;
  for (const [otherId, other] of clients) {
    if (otherId === id) continue;
    if (other.dbBundle.raw === raw) return true;
  }
  return false;
}

export async function crashClientImpl(
  k: BootedSimKernel,
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
  k: BootedSimKernel,
  nodeId: string,
  event: SimCrashEvent
): Promise<boolean> {
  if (!k.faults.takeCrash(nodeId, event)) return false;
  if (k.clients.has(nodeId)) {
    await crashClientImpl(k, nodeId, { keepDb: true });
  }
  return true;
}

export function wireMutateCrashArm(
  k: BootedSimKernel,
  handle: SimClientHandle
): SimClientHandle {
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

export type WorldFaultApi = {
  readonly armCrash: (nodeId: string, event: SimCrashEvent) => void;
  readonly clearCrashArms: (nodeId?: string) => void;
  readonly armHttpFault: (nodeId: string, fault: SimHttpFault) => void;
  readonly clearHttpFaults: (nodeId?: string) => void;
  readonly armPublishFault: (count: number | 'next') => void;
  readonly clearPublishFault: () => void;
  readonly armPubsubFault: (fault: SimPubsubFault) => void;
  readonly clearPubsubFaults: () => void;
};

export function worldFaultApi(faults: BoundaryFaultController): WorldFaultApi {
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
