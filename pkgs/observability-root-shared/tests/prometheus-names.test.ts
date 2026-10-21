import { describe, expect, test } from 'bun:test';
import {
  escapePrometheusName,
  prometheusFamily,
  prometheusSeries,
} from '@pkgs/observability-root-shared/prometheus-names';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

describe('the names a metrics backend stores for an OTLP instrument', () => {
  test.each([
    [
      { name: 'http.server.requests', unit: '{request}', type: 'counter' },
      { kind: 'counter', total: 'http_server_requests_total' },
    ],
    [
      { name: 'http.server.request.duration', unit: 's', type: 'histogram' },
      {
        kind: 'histogram',
        bucket: 'http_server_request_duration_seconds_bucket',
        sum: 'http_server_request_duration_seconds_sum',
        count: 'http_server_request_duration_seconds_count',
      },
    ],
    [
      { name: 'telemetry.pipeline.heartbeat', unit: '{beat}', type: 'counter' },
      { kind: 'counter', total: 'telemetry_pipeline_heartbeat_total' },
    ],
    [
      { name: 'sync.mutation.replays', unit: '{replay}', type: 'counter' },
      { kind: 'counter', total: 'sync_mutation_replays_total' },
    ],
    [
      { name: 'queue.depth.bytes', unit: 'By', type: 'counter' },
      { kind: 'counter', total: 'queue_depth_bytes_total' },
    ],
    [
      { name: 'rpc.latency', unit: 'ms', type: 'histogram' },
      {
        kind: 'histogram',
        bucket: 'rpc_latency_milliseconds_bucket',
        sum: 'rpc_latency_milliseconds_sum',
        count: 'rpc_latency_milliseconds_count',
      },
    ],
  ] as const)('%p is stored as %p', (contract, series) => {
    expect(prometheusSeries(contract)).toEqual(series);
  });

  test('a unit already in the name is not added twice, nor a total', () => {
    expect(
      prometheusFamily({
        name: 'job.duration.seconds',
        unit: 's',
        type: 'histogram',
      })
    ).toBe('job_duration_seconds');
    expect(
      prometheusSeries({ name: 'jobs.run.total', unit: '1', type: 'counter' })
    ).toEqual({ kind: 'counter', total: 'jobs_run_total' });
  });

  test('a rate unit reads as per', () => {
    expect(
      prometheusFamily({
        name: 'disk.throughput',
        unit: 'By/s',
        type: 'histogram',
      })
    ).toBe('disk_throughput_bytes_per_seconds');
  });

  test('attribute names escape the same way', () => {
    expect(escapePrometheusName('app.http.route_group')).toBe(
      'app_http_route_group'
    );
    expect(escapePrometheusName('deployment.environment.name')).toBe(
      'deployment_environment_name'
    );
  });

  test('every name is a valid Prometheus identifier, whatever the instrument', () => {
    assertProperty(
      'names are identifiers',
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9._-]{0,30}$/),
        fc.constantFrom('s', 'ms', 'By', '1', '{request}', '%', 'By/s'),
        fc.constantFrom('counter', 'histogram'),
        (name, unit, type) => {
          const series = prometheusSeries({ name, unit, type });
          const names =
            series.kind === 'counter'
              ? [series.total]
              : [series.bucket, series.sum, series.count];
          for (const each of names) {
            expect(each).toMatch(/^[a-zA-Z_:][a-zA-Z0-9_:]*$/);
          }
        }
      )
    );
  });
});
