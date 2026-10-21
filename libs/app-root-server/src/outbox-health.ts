import { createMetric } from '@pkgs/observability-root-shared/metric-contract';

/**
 * Outbox health the team sees without reading logs. Both counters are created
 * when they are recorded, because a Worker installs its meter provider after
 * this module loads.
 */
export function countExhaustedOutboxDeliveries(count: number): void {
  if (count <= 0) return;
  createMetric({
    name: 'outbox.deliveries.exhausted',
    description:
      'Outbox deliveries parked after their last attempt; each needs reconciliation',
    type: 'counter',
    unit: '{delivery}',
    dimensions: {},
    environmentScoped: true,
  })(count, {});
}

const drainRuns = () =>
  createMetric({
    name: 'outbox.drain.runs',
    description: 'Scheduled outbox drains, by whether the drain completed',
    type: 'counter',
    unit: '{run}',
    dimensions: { 'app.outcome': ['success', 'failure'] },
    environmentScoped: true,
  });

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
