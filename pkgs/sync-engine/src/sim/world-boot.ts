import type { Timers } from '../client/sim-ports';
import type { SimClientHandle } from './client-factory';
import { createSimClock, type SimClock } from './clock';
import {
  type ClockSkewTable,
  createClockSkewTable,
  SIM_SERVER_NODE_ID,
} from './clock-skew';
import { RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import { bindSimHttpServer } from './http-bridge';
import { createSimNetwork, type SimNetwork } from './network';
import { createSimPubSubBroker, type SimPubSubBroker } from './pubsub-bridge';
import { createSeededRng, type SeededRng } from './rng';
import { createSimScheduler, type SimScheduler } from './scheduler';
import { openSimServer, type SimServer } from './server';
import { createSimTimers } from './timers';
import { BROKER, SERVER_HTTP, SERVER_PUB } from './traffic';
import type { ClientMeta, WorldClientOpts } from './world-ops';

export type BootedSimKernel = {
  readonly rng: SeededRng;
  readonly clock: SimClock;
  readonly clockSkew: ClockSkewTable;
  readonly scheduler: SimScheduler;
  readonly timers: Timers;
  readonly network: SimNetwork;
  readonly server: SimServer;
  readonly broker: SimPubSubBroker;
  readonly clients: Map<string, SimClientHandle>;
  readonly metas: Map<string, ClientMeta>;
  readonly authByDevice: Map<string, ClientMeta>;
  readonly nextId: () => string;
  readonly worldArgs: WorldClientOpts;
  readonly nowFor: (nodeId: string) => number;
};

function resolveAuthForDevice(
  authByDevice: Map<string, ClientMeta>,
  clientId: string
) {
  const meta = authByDevice.get(clientId);
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

/** Clock, network, broker, and in-memory SQLite server for a sim world. */
export async function bootSimKernel(args: {
  readonly seed: number | bigint | string;
  readonly worldArgs: WorldClientOpts;
}): Promise<BootedSimKernel> {
  const rng = createSeededRng(args.seed);
  const clock = createSimClock(1_700_000_000_000);
  const clockSkew = createClockSkewTable();
  const nowFor = (nodeId: string): number =>
    clockSkew.nowFor(nodeId, clock.now());
  const scheduler = createSimScheduler(clock);
  const timers = createSimTimers(scheduler);
  const faults =
    args.worldArgs.sampleFaults === true
      ? sampleFaultOptions(rng.fork('faults'))
      : (args.worldArgs.faults ?? RELIABLE_FAULTS);
  const network = createSimNetwork({
    scheduler,
    rng: rng.fork('net'),
    faults,
  });

  const authByDevice = new Map<string, ClientMeta>();
  const broker = createSimPubSubBroker({ network, brokerId: BROKER });
  const server = await openSimServer({
    now: () => nowFor(SIM_SERVER_NODE_ID),
    pubsub: broker.createPubSub(SERVER_PUB),
    resolveAuth: (clientId) => resolveAuthForDevice(authByDevice, clientId),
    rowImageFanout: args.worldArgs.rowImageFanout !== false,
  });

  bindSimHttpServer({
    network,
    serverId: SERVER_HTTP,
    handlers: server.handlers,
  });

  const idRng = rng.fork('ids');
  let idCounter = 0;
  return {
    rng,
    clock,
    clockSkew,
    scheduler,
    timers,
    network,
    server,
    broker,
    clients: new Map(),
    metas: new Map(),
    authByDevice,
    worldArgs: args.worldArgs,
    nowFor,
    nextId: () => {
      idCounter += 1;
      const n = idRng.int(0x7fffffff);
      return `id-${idCounter.toString(16)}-${n.toString(16)}`;
    },
  };
}

export { BROKER, SERVER_HTTP } from './traffic';
