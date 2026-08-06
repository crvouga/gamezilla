import { createSimClock, type SimClock } from './clock';
import type { SimClientHandle } from './client-factory';
import { RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import { bindSimHttpServer } from './http-bridge';
import { createSimNetwork, type SimNetwork } from './network';
import { createSimPubSubBroker, type SimPubSubBroker } from './pubsub-bridge';
import { createSeededRng, type SeededRng } from './rng';
import { createSimScheduler, type SimScheduler } from './scheduler';
import { openSimServer, type SimServer } from './server';
import { createSimTimers } from './timers';
import type { Timers } from '../client/sim-ports';
import { type ClientMeta, type WorldClientOpts } from './world-ops';

const SERVER_HTTP = 'http:server';
const BROKER = 'pubsub:broker';
const SERVER_PUB = 'pubsub:server';

export type BootedSimKernel = {
  readonly rng: SeededRng;
  readonly clock: SimClock;
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

/** Clock, network, broker, and pg-mem server for a sim world. */
export async function bootSimKernel(args: {
  readonly seed: number | bigint | string;
  readonly worldArgs: WorldClientOpts;
}): Promise<BootedSimKernel> {
  const rng = createSeededRng(args.seed);
  const clock = createSimClock(1_700_000_000_000);
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
    now: () => clock.now(),
    pubsub: broker.createPubSub(SERVER_PUB),
    resolveAuth: (clientId) => resolveAuthForDevice(authByDevice, clientId),
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
    scheduler,
    timers,
    network,
    server,
    broker,
    clients: new Map(),
    metas: new Map(),
    authByDevice,
    worldArgs: args.worldArgs,
    nextId: () => {
      idCounter += 1;
      const n = idRng.int(0x7fffffff);
      return `id-${idCounter.toString(16)}-${n.toString(16)}`;
    },
  };
}

export { BROKER, SERVER_HTTP };
