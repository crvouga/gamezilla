import type {
  SimCrashEvent,
  SimHttpFault,
  SimPubsubFault,
} from '../boundary-faults';
import type { SimAuthStatus } from '../client-factory';
import type { SimCorruptionVariant } from '../corruption-faults';
import type { SimTraffic } from '../traffic';

export const CLIENT_IDS = ['c0', 'c1', 'c2'] as const;

export const CRASH_EVENTS: readonly SimCrashEvent[] = [
  'afterNextSyncResponseDelivered',
  'afterNextMutateResolved',
  'afterNextMutationsPostAccepted',
  'onNextTimerTickWhileSyncUndelivered',
  'onNextEngineOpenAfterCacheWipe',
];

/** Excludes arms that need scripted sync-hold (hang in random sequences). */
export const SIM_PBT_CRASH_EVENTS: readonly SimCrashEvent[] =
  CRASH_EVENTS.filter((e) => e !== 'afterNextSyncResponseDelivered');

export const CORRUPTION_VARIANTS: readonly SimCorruptionVariant[] = [
  'truncatedJson',
  'garbageString',
  'flipField',
];

export const HTTP_FAULTS: readonly SimHttpFault[] = [
  { kind: 'dropMutationsResponse' },
  { kind: 'dropQueryResponse' },
  { kind: 'failMutationsAfterCommit' },
  { kind: 'failMutationsInsideTxnAfter', after: 0 },
  { kind: 'invalidMutationsBody' },
  { kind: 'serverErrorOnNext', route: 'mutations' },
  { kind: 'serverErrorOnNext', route: 'query' },
  ...CORRUPTION_VARIANTS.flatMap((variant) => [
    { kind: 'corruptMutationsResponse' as const, variant },
    { kind: 'corruptQueryResponse' as const, variant },
  ]),
  { kind: 'rateLimited', route: 'mutations', retryAfterMs: 2_000 },
  { kind: 'rateLimited', route: 'query', retryAfterMs: 1_000 },
  { kind: 'abortResponseBody', route: 'mutations' },
  { kind: 'abortResponseBody', route: 'query' },
  { kind: 'batchTooLarge' },
  { kind: 'authExpiredInFlight', route: 'mutations' },
  { kind: 'authExpiredInFlight', route: 'query' },
];

export const PUBSUB_FAULTS: readonly SimPubsubFault[] = [
  { kind: 'corruptPubsubPayload', variant: 'truncatedJson' },
  { kind: 'corruptPubsubPayload', variant: 'flipField' },
  { kind: 'dropTopic', topic: 'user:notes-all', count: 1 },
  { kind: 'duplicatePublish', count: 1 },
];

export const STORAGE_TAMPERS = [
  'corruptCheckpoint',
  'flipDomainRow',
  'corruptQueuedArgs',
  'corruptLastHash',
] as const;

export const SCHEMA_VARIANTS = [
  'baseline',
  'extraColumn',
  'extraTable',
  'epochBump',
] as const;

export const AUTH_STATUSES: readonly SimAuthStatus[] = [
  'valid',
  'expired',
  'revoked',
];

export const STORAGE_PRESSURES = [
  'sqliteFull',
  'tornTxnAfterStatement',
] as const;

export const SKEW_MS_VALUES = [
  -86_400_000, -3_600_000, -60_000, 0, 60_000, 3_600_000, 86_400_000,
] as const;

export const HOLD_TRAFFIC: readonly SimTraffic[] = ['live', 'sync', 'all'];

export type SyncReal = {
  readonly clientIds: readonly string[];
  readonly actions: import('./actions').SyncAction[];
};

export {
  type ActionShadow as SyncModel,
  applyActionToShadow as applyActionToModel,
  clientLive,
  createActionShadow as initialSyncModel,
  domainOp,
  serverOp,
  shadowAllowsAction as modelAllowsAction,
} from './action-shadow';
