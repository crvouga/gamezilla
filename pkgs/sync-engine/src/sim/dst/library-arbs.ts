import fc from 'fast-check';

import type { SimSessionQuery } from '../domain-pack';
import type { LibraryAction } from './actions';
import {
  AUTH_STATUSES,
  CLIENT_IDS,
  CORRUPTION_VARIANTS,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  PUBSUB_FAULTS,
  SCHEMA_VARIANTS,
  SKEW_MS_VALUES,
  STORAGE_PRESSURES,
  STORAGE_TAMPERS,
  WORLD_PBT_CRASH_EVENTS,
} from './world-model';

/** Mild fixed reorder/loss so `setFaults` perturbs without stalling sync. */
export const MILD_NET_FAULTS = {
  packetLossProbability: 0.05,
  reorderWindow: 2,
  partitionProbability: 0.02,
} as const;

type Arb = fc.Arbitrary<LibraryAction>;
type PickClient = fc.Arbitrary<string>;

const trafficArb = fc.constantFrom(...HOLD_TRAFFIC);

export function defaultClientIds(
  clientIds: readonly string[]
): readonly string[] {
  return clientIds.length > 0 ? clientIds : [...CLIENT_IDS].slice(0, 2);
}

function nextPeerEngineId(clientIds: readonly string[]): string {
  let max = -1;
  for (const id of clientIds) {
    const parsed = Number.parseInt(id.slice(1), 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return `c${max + 1}`;
}

const CONNECTIVITY_KINDS = [
  'offline',
  'online',
  'disconnect',
  'connect',
  'background',
  'foreground',
] as const;

function connectivityArbs(pick: PickClient): Arb[] {
  return CONNECTIVITY_KINDS.map((kind) =>
    pick.map((clientId): LibraryAction => ({ kind, clientId }))
  );
}

function networkArbs(pick: PickClient): Arb[] {
  const nodeAndTraffic = fc.tuple(pick, trafficArb);
  return [
    nodeAndTraffic.map(
      ([nodeId, traffic]): LibraryAction => ({
        kind: 'partition',
        nodeId,
        traffic,
      })
    ),
    nodeAndTraffic.map(
      ([nodeId, traffic]): LibraryAction => ({ kind: 'hold', nodeId, traffic })
    ),
    nodeAndTraffic.map(
      ([nodeId, traffic]): LibraryAction => ({
        kind: 'release',
        nodeId,
        traffic,
      })
    ),
    fc.constant<LibraryAction>({ kind: 'heal' }),
    fc.integer({ min: 1, max: 40 }).map(
      (ms): LibraryAction => ({
        kind: 'idle',
        ms,
      })
    ),
    nodeAndTraffic.map(
      ([nodeId, traffic]): LibraryAction => ({
        kind: 'setFaults',
        nodeId,
        traffic,
        faults: MILD_NET_FAULTS,
      })
    ),
  ];
}

function boundaryFaultArbs(pick: PickClient): Arb[] {
  return [
    fc.tuple(pick, fc.constantFrom(...HTTP_FAULTS)).map(
      ([clientId, fault]): LibraryAction => ({
        kind: 'armHttpFault',
        clientId,
        fault,
      })
    ),
    fc.tuple(pick, fc.constantFrom(...WORLD_PBT_CRASH_EVENTS)).map(
      ([clientId, event]): LibraryAction => ({
        kind: 'armCrashAt',
        clientId,
        event,
      })
    ),
    fc
      .constantFrom(1, 2, 'next' as const)
      .map((count): LibraryAction => ({ kind: 'publishFault', count })),
    fc.tuple(pick, fc.constantFrom(...AUTH_STATUSES)).map(
      ([clientId, status]): LibraryAction => ({
        kind: 'auth',
        clientId,
        status,
      })
    ),
    fc
      .constantFrom(...PUBSUB_FAULTS)
      .map((fault): LibraryAction => ({ kind: 'armPubsubFault', fault })),
    fc.constantFrom(...CORRUPTION_VARIANTS).map(
      (variant): LibraryAction => ({
        kind: 'armPubsubFault',
        fault: { kind: 'corruptPubsubPayload', variant },
      })
    ),
  ];
}

function lifecycleArbs(args: {
  readonly ids: readonly string[];
  readonly pick: PickClient;
  readonly sessionQuery: SimSessionQuery;
}): Arb[] {
  const { ids, pick, sessionQuery } = args;
  return [
    pick.map((clientId): LibraryAction => ({ kind: 'crash', clientId })),
    pick.map((clientId): LibraryAction => ({ kind: 'restart', clientId })),
    pick.map(
      (clientId): LibraryAction => ({
        kind: 'clearLocalData',
        clientId,
        reason: 'pbt',
      })
    ),
    pick.map(
      (clientId): LibraryAction => ({
        kind: 'subscribe',
        clientId,
        queryName: sessionQuery.name,
        params: sessionQuery.params,
      })
    ),
    fc.constant<LibraryAction>({ kind: 'serverCrash' }),
    fc.constant<LibraryAction>({ kind: 'serverRestart' }),
    fc
      .tuple(
        fc.constantFrom(...ids, 'server'),
        fc.constantFrom(...SKEW_MS_VALUES)
      )
      .map(
        ([nodeId, skewMs]): LibraryAction => ({
          kind: 'skew',
          nodeId,
          skewMs,
        })
      ),
  ];
}

function chaosArbs(ids: readonly string[], pick: PickClient): Arb[] {
  return [
    fc.tuple(pick, fc.constantFrom(...STORAGE_TAMPERS)).map(
      ([clientId, tamper]): LibraryAction => ({
        kind: 'tamperLocalStorage',
        clientId,
        tamper,
      })
    ),
    fc.tuple(pick, fc.constantFrom(...STORAGE_PRESSURES)).map(
      ([clientId, pressure]): LibraryAction => ({
        kind: 'armStoragePressure',
        clientId,
        pressure,
      })
    ),
    fc.tuple(pick, fc.constantFrom(...SCHEMA_VARIANTS)).map(
      ([clientId, variant]): LibraryAction => ({
        kind: 'restartWithSchema',
        clientId,
        variant,
      })
    ),
    pick.map((clientId): LibraryAction => ({ kind: 'protocolCut', clientId })),
    fc.constant<LibraryAction>({ kind: 'brokerCrash' }),
    fc.constant<LibraryAction>({ kind: 'brokerRestart' }),
    fc.constant<LibraryAction>({
      kind: 'pruneServerArtifacts',
      olderThanMs: -1_000_000,
    }),
    pick.map((clientId): LibraryAction => ({ kind: 'failNextOpen', clientId })),
    pick.map((clientId): LibraryAction => ({ kind: 'freeze', clientId })),
    pick.map((clientId): LibraryAction => ({ kind: 'thaw', clientId })),
    pick.map(
      (donor): LibraryAction => ({
        kind: 'addPeerEngine',
        clientId: nextPeerEngineId(ids),
        shareWithClientId: donor,
      })
    ),
  ];
}

/** Every {@link LibraryAction} shape, one arbitrary per shape. */
export function libraryActionArbs(ctx: {
  readonly clientIds: readonly string[];
  readonly sessionQuery: SimSessionQuery;
}): Arb[] {
  const ids = defaultClientIds(ctx.clientIds);
  const pick = fc.constantFrom(...ids);
  return [
    ...connectivityArbs(pick),
    ...networkArbs(pick),
    ...boundaryFaultArbs(pick),
    ...lifecycleArbs({ ids, pick, sessionQuery: ctx.sessionQuery }),
    ...chaosArbs(ids, pick),
  ];
}
