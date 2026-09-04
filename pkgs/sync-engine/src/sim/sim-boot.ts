import type { SyncBootDeps } from './boot-deps';
import {
  type BoundaryFaultController,
  createBoundaryFaultController,
} from './boundary-faults';
import type { SimAuthStatus } from './client-factory';
import { bindSimHttpServer } from './http-bridge';
import {
  type BootRuntime,
  createBootRuntime,
  makeNextId,
  resolveAuthForDevice,
  resolveBootDomain,
  SIM_SERVER_NODE_ID,
} from './kit-boot-parts';
import { fireCrashIfArmed } from './kit-lifecycle';
import type { BootedSimKernel, ClientMeta, KitClientOpts } from './kit-types';
import type { SyncNetwork } from './network';
import { openSimServer } from './server';
import { createStoragePressureController } from './storage-pressure';
import { SERVER_HTTP, SERVER_PUB } from './traffic';

export type { BootedSimKernel } from './kit-types';

/** Deps + network + broker + boundary faults, before the server exists. */
export type SimInfra = {
  readonly deps: SyncBootDeps;
  readonly boundaryFaults: BoundaryFaultController;
  readonly runtime: BootRuntime;
};

/** Session-derived deps + network for `createSyncSurface` boot. */
export type InjectedSimPorts = {
  readonly deps: SyncBootDeps;
  readonly network: SyncNetwork;
};

export function bootSimInfra(args: {
  readonly clientOpts: KitClientOpts;
  readonly injected: InjectedSimPorts;
}): SimInfra {
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

/** In-memory SQLite server + HTTP bind on top of {@link bootSimInfra}. */
export async function bootSimServer(args: {
  readonly infra: SimInfra;
  readonly clientOpts: KitClientOpts;
}): Promise<BootedSimKernel> {
  const { runtime, boundaryFaults } = args.infra;
  const rng = args.infra.deps.rng;
  const domain = resolveBootDomain(args.clientOpts);
  const authByDevice = new Map<string, ClientMeta>();
  const authStatusByDevice = new Map<string, SimAuthStatus>();
  const serverPub = runtime.broker.createPubSub(SERVER_PUB);
  const nextId = makeNextId(rng);
  const server = await openSimServer({
    now: () => runtime.nowFor(SIM_SERVER_NODE_ID),
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

  const kernel: BootedSimKernel = {
    rng,
    clock: runtime.scheduler.clock,
    clockSkew: runtime.clockSkew,
    scheduler: runtime.scheduler,
    timers: runtime.timers,
    network: runtime.network,
    server,
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

  kernel.unbindHttp = bindSimHttpServer({
    network: runtime.network,
    serverId: SERVER_HTTP,
    handlers: server.handlers,
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
