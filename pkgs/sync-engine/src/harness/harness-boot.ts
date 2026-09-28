import type { SyncBootDeps } from './boot-deps';
import type { HarnessAuthStatus } from './client-factory';
import {
  createBoundaryFaultController,
  type EdgeFaultController,
} from './edge-faults';
import {
  type BootRuntime,
  createBootRuntime,
  HARNESS_SERVER_NODE_ID,
  makeNextId,
  resolveAuthForDevice,
  resolveBootDomain,
} from './harness-boot-parts';
import { fireCrashIfArmed } from './harness-lifecycle';
import type {
  BootedHarnessKernel,
  ClientMeta,
  HarnessClientOpts,
} from './harness-types';
import { bindHarnessHttpLoadBalancer } from './http-bridge';
import type { SyncNetwork } from './network';
import { openHarnessServerCluster } from './server-cluster';
import { createStoragePressureController } from './storage-pressure';
import { SERVER_HTTP, SERVER_PUB } from './traffic';

export type { BootedHarnessKernel } from './harness-types';

/** Deps + network + broker + boundary faults, before the server exists. */
export type HarnessInfra = {
  readonly deps: SyncBootDeps;
  readonly boundaryFaults: EdgeFaultController;
  readonly runtime: BootRuntime;
};

/** Session-derived deps + network for `createSyncHarness` boot. */
export type InjectedHarnessPorts = {
  readonly deps: SyncBootDeps;
  readonly network: SyncNetwork;
};

export function bootHarnessInfra(args: {
  readonly clientOpts: HarnessClientOpts;
  readonly injected: InjectedHarnessPorts;
}): HarnessInfra {
  const deps = args.injected.deps;
  const boundaryFaults = createBoundaryFaultController();
  const runtime = createBootRuntime({
    deps,
    clientOpts: args.clientOpts,
    boundaryFaults,
    network: args.injected.network,
  });
  return { deps, boundaryFaults, runtime };
}

/** Shared-DB server nodes plus the round-robin HTTP ingress. */
export async function bootHarnessServer(args: {
  readonly infra: HarnessInfra;
  readonly clientOpts: HarnessClientOpts;
}): Promise<BootedHarnessKernel> {
  const { runtime, boundaryFaults } = args.infra;
  const rng = args.infra.deps.rng;
  const domain = resolveBootDomain(args.clientOpts);
  const authByDevice = new Map<string, ClientMeta>();
  const authStatusByDevice = new Map<string, HarnessAuthStatus>();
  const serverPub = runtime.broker.createPubSub(SERVER_PUB);
  const nextId = makeNextId(rng);
  const serverNodes = await openHarnessServerCluster({
    now: () => runtime.nowFor(HARNESS_SERVER_NODE_ID),
    createId: nextId,
    pubsub: serverPub,
    resolveAuth: (clientId) => resolveAuthForDevice(authByDevice, clientId),
    rowImageFanout: args.clientOpts.rowImageFanout !== false,
    localSchema: domain.localSchema,
    mutationRegistry: domain.mutationRegistry,
    queryRegistry: domain.queryRegistry,
    faults: boundaryFaults,
    ...(domain.topicMap !== undefined ? { topicMap: domain.topicMap } : {}),
  });
  const server = serverNodes[0]!.server;

  const kernel: BootedHarnessKernel = {
    rng,
    clock: runtime.scheduler.clock,
    clockSkew: runtime.clockSkew,
    scheduler: runtime.scheduler,
    timers: runtime.timers,
    network: runtime.network,
    server,
    serverNodes,
    broker: runtime.broker,
    clients: new Map(),
    metas: new Map(),
    authByDevice,
    authStatusByDevice,
    storagePressure: createStoragePressureController(),
    frozenClients: new Set(),
    failNextOpenClients: new Set(),
    clientOpts: args.clientOpts,
    domain,
    nowFor: runtime.nowFor,
    faults: boundaryFaults,
    serverPub,
    unbindHttp: () => undefined,
    nextId,
  };

  kernel.unbindHttp = bindHarnessHttpLoadBalancer({
    network: runtime.network,
    balancerId: SERVER_HTTP,
    nodes: serverNodes.map((node) => ({
      id: node.endpointId,
      handlers: node.server.handlers,
    })),
    faults: boundaryFaults,
    onMutationsAccepted: async (clientNodeId) => {
      await fireCrashIfArmed(
        kernel,
        clientNodeId,
        'afterNextMutationsPostAccepted'
      );
    },
  });

  return kernel;
}

export { BROKER, SERVER_HTTP } from './traffic';
