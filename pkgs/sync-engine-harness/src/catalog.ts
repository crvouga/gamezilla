import type { HarnessAuthStatus } from './client-factory-parts';
import type { HarnessCorruptionVariant } from './corruption-faults';
import type { HarnessPubsubFault } from './edge-fault-pubsub';
import type { HarnessCrashEvent, HarnessHttpFault } from './edge-faults';
import type { HarnessTraffic } from './traffic';

export const CLIENT_IDS = ['c0', 'c1', 'c2'] as const;

export const CRASH_EVENTS: readonly HarnessCrashEvent[] = [
  'afterNextSyncResponseDelivered',
  'afterNextMutateResolved',
  'afterNextMutationsPostAccepted',
  'onNextTimerTickWhileSyncUndelivered',
  'onNextEngineOpenAfterCacheWipe',
];

/** Excludes arms that need scripted sync-hold (hang in random sequences). */
export const HARNESS_PBT_CRASH_EVENTS: readonly HarnessCrashEvent[] =
  CRASH_EVENTS.filter((e) => e !== 'afterNextSyncResponseDelivered');

export const CORRUPTION_VARIANTS: readonly HarnessCorruptionVariant[] = [
  'truncatedJson',
  'garbageString',
  'flipField',
];

export const HTTP_FAULTS: readonly HarnessHttpFault[] = [
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

export const PUBSUB_FAULTS_BASE: readonly HarnessPubsubFault[] = [
  { kind: 'corruptPubsubPayload', variant: 'truncatedJson' },
  { kind: 'corruptPubsubPayload', variant: 'flipField' },
  { kind: 'duplicatePublish', count: 1 },
];

/** Pubsub chaos arms; include `dropTopic` when the domain pack supplies one. */
export function pubsubFaults(
  fuzzDropTopic?: string
): readonly HarnessPubsubFault[] {
  if (fuzzDropTopic === undefined || fuzzDropTopic.length === 0) {
    return PUBSUB_FAULTS_BASE;
  }
  return [
    ...PUBSUB_FAULTS_BASE,
    { kind: 'dropTopic', topic: fuzzDropTopic, count: 1 },
  ];
}
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

export const AUTH_STATUSES: readonly HarnessAuthStatus[] = [
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

export const HOLD_TRAFFIC: readonly HarnessTraffic[] = ['live', 'sync', 'all'];

/** Mild fixed reorder/loss so `setFaults` perturbs without stalling sync. */
export const MILD_NET_FAULTS = {
  dropProbability: 0.05,
  reorderWindow: 2,
  partitionProbability: 0.02,
} as const;
