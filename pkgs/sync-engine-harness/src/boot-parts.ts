import { createSeededCreateId } from '@pkgs/uuid-shared/seeded-create-id';
import type { SeededRng } from '@pkgs/uuid-shared/seeded-rng';
import type { SyncBootDeps } from './boot-deps';
import { createClockSkewTable } from './clock-skew';
import type { EdgeFaultController } from './edge-faults';
import type { HarnessFaultOptions } from './faults';
import { DST_FAULTS, RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import type { HarnessDomainPack } from './harness-domain-pack';
import type { SyncNetwork } from './network';
import { createHarnessPubSubBroker } from './pubsub-bridge';
import { BROKER } from './traffic';
import type { ClientMeta, HarnessClientOpts } from './types';

export function resolveBootDomain(
  clientOpts: HarnessClientOpts
): HarnessDomainPack {
  const baseDomain = clientOpts.domain;
  return {
    ...baseDomain,
    localSchema: clientOpts.localSchema ?? baseDomain.localSchema,
    mutationRegistry:
      clientOpts.mutationRegistry ?? baseDomain.mutationRegistry,
    queryRegistry: clientOpts.queryRegistry ?? baseDomain.queryRegistry,
    sessionQuery: (clientOpts.sessionQuery ??
      baseDomain.sessionQuery) as HarnessDomainPack['sessionQuery'],
  };
}

export type BootRuntimeDeps = SyncBootDeps;

export type CreateBootRuntimeArgs = {
  readonly deps: BootRuntimeDeps;
  readonly clientOpts: HarnessClientOpts;
  readonly boundaryFaults?: EdgeFaultController;
  /** Framework-owned network (framework systems wrap `@pkgs/harness-shared`'s kernel). */
  readonly network: SyncNetwork;
};

function resolveKitFaults(args: CreateBootRuntimeArgs): HarnessFaultOptions {
  const { clientOpts } = args;
  if (clientOpts.sampleFaults === true) {
    return sampleFaultOptions(args.deps.rng.fork('faults'));
  }
  if (clientOpts.faults !== undefined) return clientOpts.faults;
  return clientOpts.dstFaults === true ? DST_FAULTS : RELIABLE_FAULTS;
}

export function createBootRuntime(args: CreateBootRuntimeArgs) {
  const { deps, clientOpts, boundaryFaults } = args;
  const clockSkew = createClockSkewTable();
  const nowFor = (nodeId: string): number =>
    clockSkew.nowFor(nodeId, deps.clock.now());
  const network = args.network;
  if (
    clientOpts.sampleFaults === true ||
    clientOpts.faults !== undefined ||
    clientOpts.dstFaults === true
  ) {
    // Explicit clientOpts win; otherwise keep framework networkFaults.
    network.setDefaultFaults(resolveKitFaults(args));
  }
  const broker = createHarnessPubSubBroker({
    network,
    brokerId: BROKER,
    ...(boundaryFaults !== undefined ? { faults: boundaryFaults } : {}),
    rng: deps.rng.fork('pubsub-faults'),
    liveResendOnReconnect: clientOpts.liveResendOnReconnect === true,
  });
  return {
    clock: deps.clock,
    clockSkew,
    nowFor,
    scheduler: deps.scheduler,
    timers: deps.timers,
    network,
    broker,
  };
}

export type BootRuntime = ReturnType<typeof createBootRuntime>;

function lookupClientMeta(
  authByDevice: Map<string, ClientMeta>,
  clientId: string
): ClientMeta | undefined {
  const direct = authByDevice.get(clientId);
  if (direct !== undefined) return direct;
  for (const meta of authByDevice.values()) {
    if (meta.id === clientId || meta.deviceId === clientId) return meta;
  }
  return undefined;
}

export function resolveAuthForDevice(
  authByDevice: Map<string, ClientMeta>,
  clientId: string
) {
  const meta = lookupClientMeta(authByDevice, clientId);
  if (meta === undefined) {
    return {
      actorId: clientId,
      deviceId: clientId,
      accountId: null,
      isAnon: true,
    };
  }
  return {
    actorId: meta.actorId,
    deviceId: meta.deviceId,
    accountId: `acct:${meta.actorId}`,
    isAnon: false,
  };
}

export function makeNextId(rng: SeededRng): () => string {
  // Every framework row uses the same injected allocator. Keep the stream
  // UUID-shaped so internal-table ids satisfy the same invariant as wall ids.
  return createSeededCreateId(rng.fork('ids').random);
}
