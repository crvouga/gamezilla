import type { SeededRng } from '@pkgs/uuid';
import type { SyncBootDeps } from './boot-deps';
import type { BoundaryFaultController } from './boundary-faults';
import type { SimAuthStatus } from './client-factory';
import { createClockSkewTable, SIM_SERVER_NODE_ID } from './clock-skew';
import type { SimDomainPack } from './domain-pack';
import type { SimFaultOptions } from './faults';
import { DST_FAULTS, RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import type { ClientMeta, KitClientOpts, SimClock } from './kit-types';
import type { SyncNetwork } from './network';
import { createSimPubSubBroker } from './pubsub-bridge';
import { BROKER } from './traffic';

export function resolveBootDomain(clientOpts: KitClientOpts): SimDomainPack {
  const baseDomain = clientOpts.domain;
  return {
    ...baseDomain,
    localSchema: clientOpts.localSchema ?? baseDomain.localSchema,
    mutationRegistry:
      clientOpts.mutationRegistry ?? baseDomain.mutationRegistry,
    queryRegistry: clientOpts.queryRegistry ?? baseDomain.queryRegistry,
    sessionQuery: (clientOpts.sessionQuery ??
      baseDomain.sessionQuery) as SimDomainPack['sessionQuery'],
  };
}

export type BootRuntimeDeps = SyncBootDeps;

export type CreateBootRuntimeArgs = {
  readonly deps: BootRuntimeDeps;
  readonly clientOpts: KitClientOpts;
  readonly boundaryFaults?: BoundaryFaultController;
  /** Framework-owned network (framework systems wrap `@pkgs/dst`'s kernel). */
  readonly network: SyncNetwork;
};

function resolveKitFaults(args: CreateBootRuntimeArgs): SimFaultOptions {
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
  const broker = createSimPubSubBroker({
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
  const idRng = rng.fork('ids');
  let idCounter = 0;
  return (): string => {
    idCounter += 1;
    const n = idRng.int(0x7fffffff);
    return `id-${idCounter.toString(16)}-${n.toString(16)}`;
  };
}

export type { SimAuthStatus, SimClock };
export { SIM_SERVER_NODE_ID };
