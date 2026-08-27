import type { BoundaryFaultController } from './boundary-faults';
import type { SimAuthStatus } from './client-factory';
import { createSimClock, type SimClock } from './clock';
import { createClockSkewTable, SIM_SERVER_NODE_ID } from './clock-skew';
import type { SimDomainPack } from './domain-pack';
import { DST_FAULTS, RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import { createSimNetwork } from './network';
import { createSimPubSubBroker } from './pubsub-bridge';
import type { SeededRng } from './rng';
import { createSimScheduler } from './scheduler';
import { createSimTimers } from './timers';
import { BROKER } from './traffic';
import type { ClientMeta, WorldClientOpts } from './world-types';

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

export function createBootRuntime(
  rng: SeededRng,
  worldArgs: WorldClientOpts,
  boundaryFaults?: BoundaryFaultController
) {
  const clock = createSimClock(1_700_000_000_000);
  const clockSkew = createClockSkewTable();
  const nowFor = (nodeId: string): number =>
    clockSkew.nowFor(nodeId, clock.now());
  const scheduler = createSimScheduler(clock);
  const timers = createSimTimers(scheduler);
  const faults =
    worldArgs.sampleFaults === true
      ? sampleFaultOptions(rng.fork('faults'))
      : worldArgs.faults !== undefined
        ? worldArgs.faults
        : worldArgs.dstFaults === true
          ? DST_FAULTS
          : RELIABLE_FAULTS;
  const network = createSimNetwork({
    scheduler,
    rng: rng.fork('net'),
    faults,
  });
  const broker = createSimPubSubBroker({
    network,
    brokerId: BROKER,
    ...(boundaryFaults !== undefined ? { faults: boundaryFaults } : {}),
    rng: rng.fork('pubsub-faults'),
    liveResendOnReconnect: worldArgs.liveResendOnReconnect === true,
  });
  return { clock, clockSkew, nowFor, scheduler, timers, network, broker };
}

export function resolveAuthForDevice(
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
