import type {
  Attributes as OtelAttributes,
  Span,
  TimeInput,
} from '@opentelemetry/api';
import type { Attributes } from './attributes';
import { ATTR } from './attributes';

export const EVENT = {
  MUTATION_APPLIED_OPTIMISTICALLY: 'app.mutation.applied_optimistically',
  MUTATION_PERSISTED: 'app.mutation.persisted',
  MUTATION_ENQUEUED: 'app.mutation.enqueued',
  MUTATION_SENT: 'app.mutation.sent',
  MUTATION_ACKED: 'app.mutation.acked',
  MUTATION_REBASED: 'app.mutation.rebased',
  MUTATION_CONFLICT: 'app.mutation.conflict',
  MUTATION_ROLLED_BACK: 'app.mutation.rolled_back',
  MUTATION_REJECTED: 'app.mutation.rejected',
  SYNC_BATCH_FLUSHED: 'app.sync.batch.flushed',
  SYNC_CLOCK_SKEW_OBSERVED: 'app.sync.clock_skew_observed',
  SYNC_CONNECTED: 'app.sync.connected',
  SYNC_DISCONNECTED: 'app.sync.disconnected',
  SYNC_HYDRATED: 'app.sync.hydrated',
  INTERACTION_CLICKED: 'app.interaction.clicked',
  INTERACTION_SUBMITTED: 'app.interaction.submitted',
  ROUTE_CHANGED: 'app.route.changed',
  REQUEST_RETRIED: 'app.request.retried',
  REQUEST_FAILED: 'app.request.failed',
  DATABASE_RECONCILED: 'app.database.reconciled',
  LOG_EMITTED: 'app.log.emitted',
} as const;

type MutationAttributes = Pick<Attributes, 'app.mutation.id'>;
type BatchAttributes = Pick<Attributes, 'app.sync.batch_size'>;
type SkewAttributes = Pick<Attributes, 'app.clock_skew_ms'>;
type LogAttributes = {
  'app.log.severity': 'debug' | 'info' | 'warn' | 'error';
  'app.log.message': string;
  'app.log.name': string;
};

export type EventAttributes = {
  [EVENT.MUTATION_APPLIED_OPTIMISTICALLY]: MutationAttributes;
  [EVENT.MUTATION_PERSISTED]: MutationAttributes;
  [EVENT.MUTATION_ENQUEUED]: MutationAttributes;
  [EVENT.MUTATION_SENT]: MutationAttributes;
  [EVENT.MUTATION_ACKED]: MutationAttributes;
  [EVENT.MUTATION_REBASED]: MutationAttributes;
  [EVENT.MUTATION_CONFLICT]: MutationAttributes;
  [EVENT.MUTATION_ROLLED_BACK]: MutationAttributes;
  [EVENT.MUTATION_REJECTED]: MutationAttributes;
  [EVENT.SYNC_BATCH_FLUSHED]: BatchAttributes;
  [EVENT.SYNC_CLOCK_SKEW_OBSERVED]: SkewAttributes;
  [EVENT.SYNC_CONNECTED]: Attributes;
  [EVENT.SYNC_DISCONNECTED]: Attributes;
  [EVENT.SYNC_HYDRATED]: Attributes;
  [EVENT.INTERACTION_CLICKED]: Attributes;
  [EVENT.INTERACTION_SUBMITTED]: Attributes;
  [EVENT.ROUTE_CHANGED]: Attributes;
  [EVENT.REQUEST_RETRIED]: Attributes;
  [EVENT.REQUEST_FAILED]: Attributes;
  [EVENT.DATABASE_RECONCILED]: Attributes;
  [EVENT.LOG_EMITTED]: LogAttributes;
};

export function addEvent<K extends keyof EventAttributes>(
  span: Span,
  name: K,
  attributes: EventAttributes[K],
  time?: TimeInput
): void {
  span.addEvent(name, attributes as OtelAttributes, time);
}

export const events = {
  mutationAppliedOptimistically(span: Span, mutationId: string) {
    addMutationEvent(span, EVENT.MUTATION_APPLIED_OPTIMISTICALLY, mutationId);
  },
  mutationPersisted(span: Span, mutationId: string) {
    addMutationEvent(span, EVENT.MUTATION_PERSISTED, mutationId);
  },
  mutationEnqueued(span: Span, mutationId: string) {
    addMutationEvent(span, EVENT.MUTATION_ENQUEUED, mutationId);
  },
  mutationSent(span: Span, mutationId: string) {
    addMutationEvent(span, EVENT.MUTATION_SENT, mutationId);
  },
  mutationAcked(span: Span, mutationId: string) {
    addMutationEvent(span, EVENT.MUTATION_ACKED, mutationId);
  },
  mutationRebased(span: Span, mutationId: string) {
    addMutationEvent(span, EVENT.MUTATION_REBASED, mutationId);
  },
  mutationConflict(span: Span, mutationId: string) {
    addMutationEvent(span, EVENT.MUTATION_CONFLICT, mutationId);
  },
  mutationRolledBack(span: Span, mutationId: string) {
    addMutationEvent(span, EVENT.MUTATION_ROLLED_BACK, mutationId);
  },
  mutationRejected(span: Span, mutationId: string) {
    addMutationEvent(span, EVENT.MUTATION_REJECTED, mutationId);
  },
  syncBatchFlushed(span: Span, batchSize: number) {
    addEvent(span, EVENT.SYNC_BATCH_FLUSHED, {
      [ATTR.APP_SYNC_BATCH_SIZE]: batchSize,
    });
  },
  syncClockSkewObserved(span: Span, skewMs: number) {
    addEvent(span, EVENT.SYNC_CLOCK_SKEW_OBSERVED, {
      [ATTR.APP_CLOCK_SKEW_MS]: skewMs,
    });
  },
};

function addMutationEvent(
  span: Span,
  name: keyof Pick<
    EventAttributes,
    | 'app.mutation.applied_optimistically'
    | 'app.mutation.persisted'
    | 'app.mutation.enqueued'
    | 'app.mutation.sent'
    | 'app.mutation.acked'
    | 'app.mutation.rebased'
    | 'app.mutation.conflict'
    | 'app.mutation.rolled_back'
    | 'app.mutation.rejected'
  >,
  mutationId: string
): void {
  addEvent(span, name, { [ATTR.APP_MUTATION_ID]: mutationId });
}
