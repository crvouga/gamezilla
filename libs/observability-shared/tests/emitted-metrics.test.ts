import { describe, expect, test } from 'bun:test';
import {
  EMITTED_METRICS,
  emittedMetric,
  emittedSeriesNames,
  labelOf,
  labelsOf,
} from '@libs/observability-shared/emitted-metrics';

describe('the emitted metrics', () => {
  test('are stored under the names the dashboards and alerts have always read', () => {
    expect([...emittedSeriesNames()].sort()).toEqual([
      'billing_callbacks_total',
      'http_server_request_duration_seconds_bucket',
      'http_server_request_duration_seconds_count',
      'http_server_request_duration_seconds_sum',
      'http_server_requests_total',
      'outbox_deliveries_exhausted_total',
      'outbox_drain_runs_total',
      'sync_mutation_replays_total',
      'telemetry_business_event_export_attempts_total',
      'telemetry_logs_schema_violations_total',
      'telemetry_pipeline_heartbeat_total',
    ]);
  });

  test('are each declared once', () => {
    const names = EMITTED_METRICS.map((m) => m.contract.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('turn a dimension into the label a query selects by', () => {
    expect(labelOf('app.http.route_group')).toBe('app_http_route_group');
    const labels = labelsOf(emittedMetric('http.server.requests'));
    for (const label of [
      'http_request_method',
      'app_http_status_class',
      'app_http_route_group',
      'job',
      'instance',
    ]) {
      expect(labels.has(label)).toBe(true);
    }
    expect(labels.has('deployment_environment_name')).toBe(false);
    expect(
      labelsOf(emittedMetric('outbox.drain.runs')).has(
        'deployment_environment_name'
      )
    ).toBe(true);
    expect(labels.has('user_id')).toBe(false);
  });

  test('refuse a metric nobody emits', () => {
    expect(() => emittedMetric('http.server.errors')).toThrow(
      'no emitted metric named http.server.errors'
    );
  });

  test('let the heartbeat name any environment', () => {
    const heartbeat = emittedMetric('telemetry.pipeline.heartbeat');
    expect(heartbeat.openDimensions).toEqual(['deployment.environment.name']);
  });
});
