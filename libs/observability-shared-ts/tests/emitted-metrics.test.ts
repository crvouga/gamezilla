import { describe, expect, test } from 'bun:test';
import {
  EMITTED_METRICS,
  emittedMetric,
  emittedSeriesNames,
  labelOf,
  labelsOf,
} from '@libs/observability-shared-ts/emitted-metrics';

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
      'outbox_ready_age_seconds',
      'probe_duration_seconds',
      'probe_ssl_earliest_cert_expiry',
      'probe_success',
      'sync_mutation_replays_total',
      'sync_work_duration_seconds_bucket',
      'sync_work_duration_seconds_count',
      'sync_work_duration_seconds_sum',
      'sync_work_started_total',
      'sync_work_target_total',
      'synthetic_check_result',
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
    // Grafana Cloud copies the resource's environment onto every point.
    expect(labels.has('deployment_environment_name')).toBe(true);
    expect(labels.has('user_id')).toBe(false);
    // Synthetic Monitoring's environment is in its job name, never a label.
    expect([...labelsOf(emittedMetric('probe_success'))].sort()).toEqual([
      'instance',
      'job',
      'le',
    ]);
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
