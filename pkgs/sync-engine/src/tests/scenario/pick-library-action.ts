import { sampleFaultOptions } from '../../sim/faults';
import type { SeededRng } from '../../sim/rng';
import type { LibraryAction } from '../../sim/scenario/actions';
import {
  AUTH_STATUSES,
  CORRUPTION_VARIANTS,
  HTTP_FAULTS,
  PUBSUB_FAULTS,
  SCHEMA_VARIANTS,
  SIM_PBT_CRASH_EVENTS,
  SKEW_MS_VALUES,
  STORAGE_PRESSURES,
  STORAGE_TAMPERS,
} from '../../sim/scenario/model';
import type { SimTraffic } from '../../sim/traffic';

const SERVER_NODE = 'server';
const HOLD_TRAFFIC: readonly SimTraffic[] = ['live', 'sync', 'all'];

function nextPeerEngineId(clientIds: readonly string[]): string {
  let max = -1;
  for (const id of clientIds) {
    const parsed = Number.parseInt(id.slice(1), 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return `c${max + 1}`;
}

type PickCtx = {
  readonly rng: SeededRng;
  readonly clientId: string;
  readonly clientIds: readonly string[];
};

type WeightedPicker = {
  readonly weight: number;
  readonly pick: (ctx: PickCtx) => LibraryAction;
};

function holdTrafficAction(
  ctx: PickCtx,
  kind: 'partition' | 'hold' | 'release'
): LibraryAction {
  return {
    kind,
    nodeId: ctx.clientId,
    traffic: ctx.rng.pick(HOLD_TRAFFIC),
  };
}

const LIBRARY_ACTION_PICKERS: readonly WeightedPicker[] = [
  { weight: 12, pick: ({ rng }) => ({ kind: 'idle', ms: 1 + rng.int(50) }) },
  { weight: 4, pick: ({ clientId }) => ({ kind: 'offline', clientId }) },
  { weight: 4, pick: ({ clientId }) => ({ kind: 'online', clientId }) },
  { weight: 2, pick: ({ clientId }) => ({ kind: 'background', clientId }) },
  { weight: 2, pick: ({ clientId }) => ({ kind: 'foreground', clientId }) },
  { weight: 2, pick: ({ clientId }) => ({ kind: 'freeze', clientId }) },
  { weight: 2, pick: ({ clientId }) => ({ kind: 'thaw', clientId }) },
  {
    weight: 3,
    pick: (ctx) => holdTrafficAction(ctx, 'partition'),
  },
  { weight: 2, pick: () => ({ kind: 'heal' }) },
  { weight: 3, pick: (ctx) => holdTrafficAction(ctx, 'hold') },
  { weight: 3, pick: (ctx) => holdTrafficAction(ctx, 'release') },
  {
    weight: 3,
    pick: ({ rng, clientId }) => ({
      kind: 'setFaults',
      nodeId: rng.int(3) === 0 ? SERVER_NODE : clientId,
      traffic: rng.pick(HOLD_TRAFFIC),
      faults: sampleFaultOptions(rng.fork('setFaults')),
    }),
  },
  {
    weight: 3,
    pick: ({ rng, clientIds }) => ({
      kind: 'skew',
      nodeId: rng.int(5) === 0 ? SERVER_NODE : rng.pick(clientIds),
      skewMs: rng.pick([...SKEW_MS_VALUES]),
    }),
  },
  { weight: 3, pick: ({ clientId }) => ({ kind: 'crash', clientId }) },
  { weight: 2, pick: ({ clientId }) => ({ kind: 'restart', clientId }) },
  { weight: 2, pick: () => ({ kind: 'serverCrash' }) },
  { weight: 2, pick: () => ({ kind: 'serverRestart' }) },
  { weight: 2, pick: () => ({ kind: 'brokerCrash' }) },
  { weight: 2, pick: () => ({ kind: 'brokerRestart' }) },
  {
    weight: 4,
    pick: ({ rng, clientId }) => ({
      kind: 'armHttpFault',
      clientId,
      fault: rng.pick([...HTTP_FAULTS]),
    }),
  },
  {
    weight: 3,
    pick: ({ rng, clientId }) => ({
      kind: 'armCrashAt',
      clientId,
      event: rng.pick([...SIM_PBT_CRASH_EVENTS]),
    }),
  },
  {
    weight: 3,
    pick: ({ rng }) => ({
      kind: 'publishFault',
      count: rng.pick([1, 2, 'next' as const]),
    }),
  },
  {
    weight: 3,
    pick: ({ rng }) => ({
      kind: 'armPubsubFault',
      fault: rng.pick([...PUBSUB_FAULTS]),
    }),
  },
  {
    weight: 3,
    pick: ({ rng, clientId }) => ({
      kind: 'tamperLocalStorage',
      clientId,
      tamper: rng.pick([...STORAGE_TAMPERS]),
    }),
  },
  {
    weight: 3,
    pick: ({ rng, clientId }) => ({
      kind: 'restartWithSchema',
      clientId,
      variant: rng.pick([...SCHEMA_VARIANTS]),
    }),
  },
  { weight: 2, pick: ({ clientId }) => ({ kind: 'protocolCut', clientId }) },
  {
    weight: 3,
    pick: ({ rng, clientId }) => ({
      kind: 'auth',
      clientId,
      status: rng.pick([...AUTH_STATUSES]),
    }),
  },
  {
    weight: 2,
    pick: ({ clientId }) => ({
      kind: 'clearLocalData',
      clientId,
      reason: 'fuzz',
    }),
  },
  { weight: 2, pick: ({ clientId }) => ({ kind: 'failNextOpen', clientId }) },
  {
    weight: 2,
    pick: ({ rng, clientId }) => ({
      kind: 'armStoragePressure',
      clientId,
      pressure: rng.pick([...STORAGE_PRESSURES]),
      afterStatements: 1 + rng.int(3),
    }),
  },
  {
    weight: 2,
    pick: ({ rng, clientIds }) => ({
      kind: 'addPeerEngine',
      clientId: nextPeerEngineId(clientIds),
      shareWithClientId: rng.pick(clientIds),
    }),
  },
  {
    weight: 2,
    pick: ({ rng }) => ({
      kind: 'pruneServerArtifacts',
      olderThanMs: -rng.int(1_000_000),
    }),
  },
  {
    weight: 5,
    pick: ({ rng }) => ({
      kind: 'armPubsubFault',
      fault: {
        kind: 'corruptPubsubPayload',
        variant: rng.pick([...CORRUPTION_VARIANTS]),
      },
    }),
  },
];

/** Pick one library-only action — weighted to match PBT command pool coverage. */
export function pickLibraryAction(
  rng: SeededRng,
  clientIds: readonly string[]
): LibraryAction {
  const roll = rng.int(100);
  const ctx: PickCtx = { rng, clientId: rng.pick(clientIds), clientIds };
  let cumulative = 0;
  for (const { weight, pick } of LIBRARY_ACTION_PICKERS) {
    cumulative += weight;
    if (roll < cumulative) return pick(ctx);
  }
  return { kind: 'idle', ms: 1 + rng.int(20) };
}

/** Combined domain + library picker for seeded fuzz loops. */
export function pickSyncAction(
  rng: SeededRng,
  clientIds: readonly string[],
  pickDomain: (
    rng: SeededRng,
    clientIds: readonly string[]
  ) =>
    | import('../../sim/scenario/actions').DomainOp
    | import('../../sim/scenario/actions').ServerOp
): import('../../sim/scenario/actions').SyncAction {
  if (rng.int(100) < 46) {
    return pickDomain(rng, clientIds);
  }
  return pickLibraryAction(rng, clientIds);
}
