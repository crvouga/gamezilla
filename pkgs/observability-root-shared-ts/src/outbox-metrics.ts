import type { MetricContract } from './metric-contract';

/**
 * Outbox deliveries parked after their last attempt. A log line alone goes
 * unseen, so the host counts them and an alert selects this count.
 */
export const OUTBOX_DELIVERIES_EXHAUSTED_METRIC: MetricContract = {
  name: 'outbox.deliveries.exhausted',
  description:
    'Outbox deliveries parked after their last attempt; each needs reconciliation',
  type: 'counter',
  unit: '{delivery}',
  dimensions: {},
  environmentScoped: true,
};

export const OUTBOX_DRAIN_RUN_OUTCOMES = ['success', 'failure'] as const;

/** Scheduled drains, so a failing drain is seen apart from the heartbeat. */
export const OUTBOX_DRAIN_RUNS_METRIC: MetricContract = {
  name: 'outbox.drain.runs',
  description: 'Scheduled outbox drains, by whether the drain completed',
  type: 'counter',
  unit: '{run}',
  dimensions: { 'app.outcome': OUTBOX_DRAIN_RUN_OUTCOMES },
  environmentScoped: true,
};

/** Oldest selected ready candidate, sampled before the drain attempts row locks. */
export const OUTBOX_READY_AGE_METRIC: MetricContract = {
  name: 'outbox.ready.age',
  description:
    'Age of the oldest selected ready outbox candidate; all consumer classes',
  type: 'gauge',
  unit: 's',
  dimensions: {},
  environmentScoped: true,
};
