import { createMetric } from '@pkgs/observability-root-shared-ts/metric-contract';
import {
  OUTBOX_DELIVERIES_EXHAUSTED_METRIC,
  OUTBOX_DRAIN_RUNS_METRIC,
  OUTBOX_READY_AGE_METRIC,
} from '@pkgs/observability-root-shared-ts/outbox-metrics';

/**
 * Outbox health the team sees without reading logs. Both counters are created
 * when they are recorded, because a Worker installs its meter provider after
 * this module loads.
 */
export function countExhaustedOutboxDeliveries(count: number): void {
  if (count <= 0) return;
  createMetric(OUTBOX_DELIVERIES_EXHAUSTED_METRIC)(count, {});
}

const drainRuns = () => createMetric(OUTBOX_DRAIN_RUNS_METRIC);

/**
 * Run the scheduled drain and count how it ended. The telemetry heartbeat
 * only says the schedule fired; this says whether the drain behind it works.
 */
export async function observeScheduledOutboxDrain<T>(
  drain: () => Promise<T>
): Promise<T> {
  try {
    const result = await drain();
    drainRuns()(1, { 'app.outcome': 'success' });
    return result;
  } catch (error: unknown) {
    drainRuns()(1, { 'app.outcome': 'failure' });
    throw error;
  }
}

export function observeOutboxReadyAge(elapsedMs: number): void {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return;
  createMetric(OUTBOX_READY_AGE_METRIC)(elapsedMs / 1000, {});
}
