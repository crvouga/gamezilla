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
  SIM_PBT_CRASH_EVENTS,
  SKEW_MS_VALUES,
  STORAGE_PRESSURES,
  STORAGE_TAMPERS,
} from './model';

/** Mild fixed reorder/loss so `setFaults` perturbs without stalling sync. */
export const MILD_NET_FAULTS = {
  dropProbability: 0.05,
  reorderWindow: 2,
  partitionProbability: 0.02,
} as const;

type Arb = fc.Arbitrary<LibraryAction>;

export type LibraryArbCtx = {
  readonly clientIds: readonly string[];
  readonly sessionQuery: SimSessionQuery;
};

/** Resolved per-run inputs shared by every library-action arbitrary. */
type ArbInputs = {
  readonly ids: readonly string[];
  readonly pick: fc.Arbitrary<string>;
  readonly sessionQuery: SimSessionQuery;
};

export type LibraryArbEntry = {
  readonly kind: LibraryAction['kind'];
  readonly make: (inputs: ArbInputs) => Arb;
};

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

const CONNECTIVITY_ENTRIES: readonly LibraryArbEntry[] = CONNECTIVITY_KINDS.map(
  (kind) => ({
    kind,
    make: ({ pick }) =>
      pick.map((clientId): LibraryAction => ({ kind, clientId })),
  })
);

function nodeAndTraffic({ pick }: ArbInputs) {
  return fc.tuple(pick, trafficArb);
}

const NETWORK_ENTRIES: readonly LibraryArbEntry[] = [
  {
    kind: 'partition',
    make: (inputs) =>
      nodeAndTraffic(inputs).map(
        ([nodeId, traffic]): LibraryAction => ({
          kind: 'partition',
          nodeId,
          traffic,
        })
      ),
  },
  {
    kind: 'hold',
    make: (inputs) =>
      nodeAndTraffic(inputs).map(
        ([nodeId, traffic]): LibraryAction => ({
          kind: 'hold',
          nodeId,
          traffic,
        })
      ),
  },
  {
    kind: 'release',
    make: (inputs) =>
      nodeAndTraffic(inputs).map(
        ([nodeId, traffic]): LibraryAction => ({
          kind: 'release',
          nodeId,
          traffic,
        })
      ),
  },
  { kind: 'heal', make: () => fc.constant<LibraryAction>({ kind: 'heal' }) },
  {
    kind: 'idle',
    make: () =>
      fc
        .integer({ min: 1, max: 40 })
        .map((ms): LibraryAction => ({ kind: 'idle', ms })),
  },
  {
    kind: 'setFaults',
    make: (inputs) =>
      nodeAndTraffic(inputs).map(
        ([nodeId, traffic]): LibraryAction => ({
          kind: 'setFaults',
          nodeId,
          traffic,
          faults: MILD_NET_FAULTS,
        })
      ),
  },
];

const BOUNDARY_FAULT_ENTRIES: readonly LibraryArbEntry[] = [
  {
    kind: 'armHttpFault',
    make: ({ pick }) =>
      fc.tuple(pick, fc.constantFrom(...HTTP_FAULTS)).map(
        ([clientId, fault]): LibraryAction => ({
          kind: 'armHttpFault',
          clientId,
          fault,
        })
      ),
  },
  {
    kind: 'armCrashAt',
    make: ({ pick }) =>
      fc.tuple(pick, fc.constantFrom(...SIM_PBT_CRASH_EVENTS)).map(
        ([clientId, event]): LibraryAction => ({
          kind: 'armCrashAt',
          clientId,
          event,
        })
      ),
  },
  {
    kind: 'publishFault',
    make: () =>
      fc
        .constantFrom(1, 2, 'next' as const)
        .map((count): LibraryAction => ({ kind: 'publishFault', count })),
  },
  {
    kind: 'auth',
    make: ({ pick }) =>
      fc.tuple(pick, fc.constantFrom(...AUTH_STATUSES)).map(
        ([clientId, status]): LibraryAction => ({
          kind: 'auth',
          clientId,
          status,
        })
      ),
  },
  {
    kind: 'armPubsubFault',
    make: () =>
      fc.oneof(
        fc
          .constantFrom(...PUBSUB_FAULTS)
          .map((fault): LibraryAction => ({ kind: 'armPubsubFault', fault })),
        fc.constantFrom(...CORRUPTION_VARIANTS).map(
          (variant): LibraryAction => ({
            kind: 'armPubsubFault',
            fault: { kind: 'corruptPubsubPayload', variant },
          })
        )
      ),
  },
];

const LIFECYCLE_ENTRIES: readonly LibraryArbEntry[] = [
  {
    kind: 'crash',
    make: ({ pick }) =>
      pick.map((clientId): LibraryAction => ({ kind: 'crash', clientId })),
  },
  {
    kind: 'restart',
    make: ({ pick }) =>
      pick.map((clientId): LibraryAction => ({ kind: 'restart', clientId })),
  },
  {
    kind: 'clearLocalData',
    make: ({ pick }) =>
      pick.map(
        (clientId): LibraryAction => ({
          kind: 'clearLocalData',
          clientId,
          reason: 'pbt',
        })
      ),
  },
  {
    kind: 'subscribe',
    make: ({ pick, sessionQuery }) =>
      pick.map(
        (clientId): LibraryAction => ({
          kind: 'subscribe',
          clientId,
          queryName: sessionQuery.name,
          params: sessionQuery.params,
        })
      ),
  },
  {
    kind: 'serverCrash',
    make: () => fc.constant<LibraryAction>({ kind: 'serverCrash' }),
  },
  {
    kind: 'serverRestart',
    make: () => fc.constant<LibraryAction>({ kind: 'serverRestart' }),
  },
  {
    kind: 'skew',
    make: ({ ids }) =>
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
  },
];

const CHAOS_ENTRIES: readonly LibraryArbEntry[] = [
  {
    kind: 'tamperLocalStorage',
    make: ({ pick }) =>
      fc.tuple(pick, fc.constantFrom(...STORAGE_TAMPERS)).map(
        ([clientId, tamper]): LibraryAction => ({
          kind: 'tamperLocalStorage',
          clientId,
          tamper,
        })
      ),
  },
  {
    kind: 'armStoragePressure',
    make: ({ pick }) =>
      fc.tuple(pick, fc.constantFrom(...STORAGE_PRESSURES)).map(
        ([clientId, pressure]): LibraryAction => ({
          kind: 'armStoragePressure',
          clientId,
          pressure,
        })
      ),
  },
  {
    kind: 'restartWithSchema',
    make: ({ pick }) =>
      fc.tuple(pick, fc.constantFrom(...SCHEMA_VARIANTS)).map(
        ([clientId, variant]): LibraryAction => ({
          kind: 'restartWithSchema',
          clientId,
          variant,
        })
      ),
  },
  {
    kind: 'protocolCut',
    make: ({ pick }) =>
      pick.map(
        (clientId): LibraryAction => ({ kind: 'protocolCut', clientId })
      ),
  },
  {
    kind: 'brokerCrash',
    make: () => fc.constant<LibraryAction>({ kind: 'brokerCrash' }),
  },
  {
    kind: 'brokerRestart',
    make: () => fc.constant<LibraryAction>({ kind: 'brokerRestart' }),
  },
  {
    kind: 'pruneServerArtifacts',
    make: () =>
      fc.constant<LibraryAction>({
        kind: 'pruneServerArtifacts',
        olderThanMs: -1_000_000,
      }),
  },
  {
    kind: 'failNextOpen',
    make: ({ pick }) =>
      pick.map(
        (clientId): LibraryAction => ({ kind: 'failNextOpen', clientId })
      ),
  },
  {
    kind: 'freeze',
    make: ({ pick }) =>
      pick.map((clientId): LibraryAction => ({ kind: 'freeze', clientId })),
  },
  {
    kind: 'thaw',
    make: ({ pick }) =>
      pick.map((clientId): LibraryAction => ({ kind: 'thaw', clientId })),
  },
  {
    kind: 'addPeerEngine',
    make: ({ ids, pick }) =>
      pick.map(
        (donor): LibraryAction => ({
          kind: 'addPeerEngine',
          clientId: nextPeerEngineId(ids),
          shareWithClientId: donor,
        })
      ),
  },
];

/** One entry per {@link LibraryAction} kind — framework actions map 1:1. */
export const LIBRARY_ARB_ENTRIES: readonly LibraryArbEntry[] = [
  ...CONNECTIVITY_ENTRIES,
  ...NETWORK_ENTRIES,
  ...BOUNDARY_FAULT_ENTRIES,
  ...LIFECYCLE_ENTRIES,
  ...CHAOS_ENTRIES,
];

function resolveArbInputs(ctx: LibraryArbCtx): ArbInputs {
  const ids = defaultClientIds(ctx.clientIds);
  return {
    ids,
    pick: fc.constantFrom(...ids),
    sessionQuery: ctx.sessionQuery,
  };
}

/** Arbitrary for one library-action kind. */
export function libraryActionArb(
  entry: LibraryArbEntry,
  ctx: LibraryArbCtx
): Arb {
  return entry.make(resolveArbInputs(ctx));
}

/** Every {@link LibraryAction} shape, one arbitrary per shape. */
export function libraryActionArbs(ctx: LibraryArbCtx): Arb[] {
  const inputs = resolveArbInputs(ctx);
  return LIBRARY_ARB_ENTRIES.map((entry) => entry.make(inputs));
}
