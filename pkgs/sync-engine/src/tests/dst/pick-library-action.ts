import type { SimFaultOptions } from '../../sim/faults';
import type { SeededRng } from '../../sim/rng';
import type { SimTraffic } from '../../sim/traffic';
import type { LibraryAction } from '../../sim/dst/actions';

const SERVER_NODE = 'server';

const SKEW_MS = [-60_000, -1_000, 0, 1_000, 60_000] as const;
const LIVE_ONLY: readonly SimTraffic[] = ['live'];
const HOLD_TRAFFIC: readonly SimTraffic[] = ['live', 'sync', 'all'];

function sampleLiveFaults(rng: SeededRng): Partial<SimFaultOptions> {
  return {
    packetLossProbability: rng.int(41) / 100,
    packetReplayProbability: rng.int(31) / 100,
    reorderWindow: rng.int(6),
    oneWayDelayMeanMs: rng.int(40),
    oneWayDelayJitterMs: rng.int(30),
  };
}

/** Pick one library-only action from a percentile roll (for seeded fuzz). */
export function pickLibraryAction(
  rng: SeededRng,
  clientIds: readonly string[]
): LibraryAction {
  const roll = rng.int(100);
  const clientId = rng.pick(clientIds);
  if (roll < 54) return { kind: 'idle', ms: 1 + rng.int(50) };
  if (roll < 60) return { kind: 'offline', clientId };
  if (roll < 66) return { kind: 'online', clientId };
  if (roll < 70) return { kind: 'background', clientId };
  if (roll < 74) return { kind: 'foreground', clientId };
  if (roll < 78) {
    return {
      kind: 'partition',
      nodeId: clientId,
      traffic: rng.pick(LIVE_ONLY),
    };
  }
  if (roll < 82) return { kind: 'heal' };
  if (roll < 85) {
    return {
      kind: 'hold',
      nodeId: clientId,
      traffic: rng.pick(HOLD_TRAFFIC),
    };
  }
  if (roll < 90) {
    return {
      kind: 'release',
      nodeId: clientId,
      traffic: rng.pick(HOLD_TRAFFIC),
    };
  }
  if (roll < 93) {
    return {
      kind: 'setFaults',
      nodeId: clientId,
      traffic: 'live',
      faults: sampleLiveFaults(rng),
    };
  }
  if (roll < 96) {
    const nodeId = rng.int(5) === 0 ? SERVER_NODE : rng.pick(clientIds);
    return {
      kind: 'skew',
      nodeId,
      skewMs: rng.pick([...SKEW_MS]),
    };
  }
  if (roll < 98) return { kind: 'crash', clientId };
  return { kind: 'restart', clientId };
}

/** Combined domain + library picker for seeded fuzz loops. */
export function pickDstAction(
  rng: SeededRng,
  clientIds: readonly string[],
  pickDomain: (
    rng: SeededRng,
    clientIds: readonly string[]
  ) => import('./actions').DomainOp | import('./actions').ServerOp
): import('./actions').DstAction {
  const roll = rng.int(100);
  if (roll < 46) {
    return pickDomain(rng, clientIds);
  }
  return pickLibraryAction(rng, clientIds);
}
