import { expect, test } from 'bun:test';
import {
  BUG_REPORT_SEND_DURATION_METRIC,
  BUG_REPORT_SENDS_METRIC,
  bugReportSendOutcome,
  createBugReportSendMetrics,
} from '@pkgs/observability-root-shared-ts/bug-report-metrics';
import { HISTOGRAM_BOUNDARIES } from '@pkgs/observability-root-shared-ts/metric-contract';

test('only a send the server could not take counts as failed', () => {
  expect([200, 201].map(bugReportSendOutcome)).toEqual(['taken', 'taken']);
  expect([400, 403, 409, 429].map(bugReportSendOutcome)).toEqual([
    'refused',
    'refused',
    'refused',
    'refused',
  ]);
  expect([500, 503].map(bugReportSendOutcome)).toEqual(['failed', 'failed']);
});

test('sends are counted and timed under the bounds the objectives read', () => {
  expect(BUG_REPORT_SENDS_METRIC.type).toBe('counter');
  expect(BUG_REPORT_SEND_DURATION_METRIC.unit).toBe('s');
  expect(HISTOGRAM_BOUNDARIES).toContain(5);
  expect(HISTOGRAM_BOUNDARIES).toContain(10);
  const record = createBugReportSendMetrics();
  expect(() => record({ status: 503, durationMs: -1 })).not.toThrow();
});
