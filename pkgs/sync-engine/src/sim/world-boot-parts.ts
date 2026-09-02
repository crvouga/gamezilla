import type { SimDeps } from '@pkgs/determinism';
import type { SeededRng } from '@pkgs/uuid';
import type { BoundaryFaultController } from './boundary-faults';
import type { SimAuthStatus } from './client-factory';
import { createClockSkewTable, SIM_SERVER_NODE_ID } from './clock-skew';
import type { SimDomainPack } from './domain-pack';
import type { SimFaultOptions } from './faults';
import { DST_FAULTS, RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import type { SimNetwork } from './network';
import { createSimPubSubBroker } from './pubsub-bridge';
import { BROKER } from './traffic';
import type { ClientMeta, SimClock, WorldClientOpts } from './world-types';

export function resolveBootDomain(worldArgs: WorldClientOpts): SimDomainPack {
  const baseDomain = worldArgs.domain;
  return {
    ...baseDomain,
    localSchema: worldArgs.localSchema ?? baseDomain.localSchema,
    mutationRegistry: worldArgs.mutationRegistry ?? baseDomain.mutationRegistry,
    queryRegistry: worldArgs.queryRegistry ?? baseDomain.queryRegistry,
    sessionQuery: (worldArgs.sessionQuery ??
      baseDomain.sessionQuery) as SimDomainPack['sessionQuery'],
  };
}

export type BootRuntimeDeps = Pick<
  SimDeps,
  'clock' | 'scheduler' | 'timers' | 'rng'
>;

export type CreateBootRuntimeArgs = {
  readonly deps: BootRuntimeDeps;
  readonly worldArgs: WorldClientOpts;
  readonly boundaryFaults?: BoundaryFaultController;
  /** Framework-owned network (framework worlds wrap `@pkgs/determinism`'s kernel). */
  readonly network: SimNetwork;
};

function resolveWorldFaults(args: CreateBootRuntimeArgs): SimFaultOptions {
  const { worldArgs } = args;
  if (worldArgs.sampleFaults === true) {
    return sampleFaultOptions(args.deps.rng.fork('faults'));
  }
  if (worldArgs.faults !== undefined) return worldArgs.faults;
  return worldArgs.dstFaults === true ? DST_FAULTS : RELIABLE_FAULTS;
}

export function createBootRuntime(args: CreateBootRuntimeArgs) {
  const { deps, worldArgs, boundaryFaults } = args;
  const clockSkew = createClockSkewTable();
  const nowFor = (nodeId: string): number =>
    clockSkew.nowFor(nodeId, deps.clock.now());
  const network = args.network;
  if (
    worldArgs.sampleFaults === true ||
    worldArgs.faults !== undefined ||
    worldArgs.dstFaults === true
  ) {
    // Explicit worldArgs win; otherwise keep framework networkDefaults.
    network.setDefaultFaults(resolveWorldFaults(args));
  }
  const broker = createSimPubSubBroker({
    network,
    brokerId: BROKER,
    ...(boundaryFaults !== undefined ? { faults: boundaryFaults } : {}),
    rng: deps.rng.fork('pubsub-faults'),
    liveResendOnReconnect: worldArgs.liveResendOnReconnect === true,
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
