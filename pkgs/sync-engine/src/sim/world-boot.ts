import { createBoundaryFaultController } from './boundary-faults';
import type { SimAuthStatus } from './client-factory';
import { bindSimHttpServer } from './http-bridge';
import { createSeededRng } from './rng';
import { openSimServer } from './server';
import { createStoragePressureController } from './storage-pressure';
import { SERVER_HTTP, SERVER_PUB } from './traffic';
import {
  createBootRuntime,
  makeNextId,
  resolveAuthForDevice,
  resolveBootDomain,
  SIM_SERVER_NODE_ID,
} from './world-boot-parts';
import { fireCrashIfArmed } from './world-lifecycle';
import type {
  BootedSimKernel,
  ClientMeta,
  WorldClientOpts,
} from './world-types';

export type { BootedSimKernel } from './world-types';

/** Clock, network, broker, and in-memory SQLite server for a sim world. */
export async function bootSimKernel(args: {
  readonly seed: number | bigint | string;
  readonly worldArgs: WorldClientOpts;
}): Promise<BootedSimKernel> {
  const rng = createSeededRng(args.seed);
  const boundaryFaults = createBoundaryFaultController();
  const runtime = createBootRuntime(rng, args.worldArgs, boundaryFaults);
  const domain = resolveBootDomain(args.worldArgs);
  const authByDevice = new Map<string, ClientMeta>();
  const authStatusByDevice = new Map<string, SimAuthStatus>();
  const serverPub = runtime.broker.createPubSub(SERVER_PUB);
  const nextId = makeNextId(rng);
  const server = await openSimServer({
    now: () => runtime.nowFor(SIM_SERVER_NODE_ID),
    createId: nextId,
    pubsub: serverPub,
    resolveAuth: (clientId) => resolveAuthForDevice(authByDevice, clientId),
    rowImageFanout: args.worldArgs.rowImageFanout !== false,
    localSchema: domain.localSchema,
    mutationRegistry: domain.mutationRegistry,
    queryRegistry: domain.queryRegistry,
    faults: boundaryFaults,
    ...(domain.topicMap !== undefined ? { topicMap: domain.topicMap } : {}),
  });

  const kernel: BootedSimKernel = {
    rng,
    clock: runtime.clock,
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
    worldArgs: args.worldArgs,
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
