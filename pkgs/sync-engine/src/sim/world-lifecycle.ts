import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type {
  BoundaryFaultController,
  SimCrashEvent,
  SimHttpFault,
} from './boundary-faults';
import type { SimClientHandle } from './client-factory';
import type { BootedSimKernel } from './world-types';

export type RestartClientOpts = {
  readonly preserveLocalDb?: boolean;
  readonly schemaEpoch?: number;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
};

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
  await handle.dispose({ keepDb: opts?.keepDb === true });
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
};

export function worldFaultApi(faults: BoundaryFaultController): WorldFaultApi {
  return {
    armCrash: (nodeId, event) => faults.armCrash(nodeId, event),
    clearCrashArms: (nodeId) => faults.clearCrashArms(nodeId),
    armHttpFault: (nodeId, fault) => faults.armHttpFault(nodeId, fault),
    clearHttpFaults: (nodeId) => faults.clearHttpFaults(nodeId),
    armPublishFault: (count) => faults.armPublishFault(count),
    clearPublishFault: () => faults.clearPublishFault(),
  };
}
