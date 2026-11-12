import type { MetricContract } from '@pkgs/observability-root-shared-ts/metric-contract';
import { createMetric } from '@pkgs/observability-root-shared-ts/metric-contract';

/**
 * What became of one bug report a person's device sent.
 *
 * - `taken`: it is on the team's list of work, now or from an earlier send.
 * - `refused`: it was turned down for good (past the daily limit, not from
 *   the app, not a bug report). The server did its job.
 * - `failed`: the server could not take it (storage or the list of work did
 *   not answer); the device keeps it and sends it again. This is the
 *   server's failure, never the person's.
 */
export const BUG_REPORT_SEND_OUTCOMES = ['taken', 'refused', 'failed'] as const;
export type BugReportSendOutcome = (typeof BUG_REPORT_SEND_OUTCOMES)[number];

export const BUG_REPORT_SENDS_METRIC: MetricContract = {
  name: 'feedback.bug_report.sends',
  description: 'Bug reports sent from devices, by what became of the send',
  type: 'counter',
  unit: '{send}',
  dimensions: { 'app.outcome': BUG_REPORT_SEND_OUTCOMES },
  environmentScoped: true,
};

export const BUG_REPORT_SEND_DURATION_METRIC: MetricContract = {
  name: 'feedback.bug_report.send.duration',
  description:
    'How long the server took to answer a sent bug report, from the send reaching it',
  type: 'histogram',
  unit: 's',
  dimensions: { 'app.outcome': BUG_REPORT_SEND_OUTCOMES },
  environmentScoped: true,
};

export function bugReportSendOutcome(status: number): BugReportSendOutcome {
  if (status >= 500) return 'failed';
  return status >= 400 ? 'refused' : 'taken';
}

/** Counts each answered send; made once the runtime's meter is installed. */
export function createBugReportSendMetrics(): (sent: {
  readonly status: number;
  readonly durationMs: number;
}) => void {
  const count = createMetric(BUG_REPORT_SENDS_METRIC);
  const duration = createMetric(BUG_REPORT_SEND_DURATION_METRIC);
  return (sent) => {
    const attributes = { 'app.outcome': bugReportSendOutcome(sent.status) };
    count(1, attributes);
    duration(Math.max(0, sent.durationMs) / 1000, attributes);
  };
}
