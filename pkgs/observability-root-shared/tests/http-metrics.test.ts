import { describe, expect, test } from 'bun:test';
import {
  createHttpMetrics,
  HTTP_METHODS,
  httpMetricContracts,
} from '@pkgs/observability-root-shared/http-metrics';
import {
  HISTOGRAM_BOUNDARIES,
  METRIC_DIMENSION_KEYS,
  SERIES_BUDGET,
} from '@pkgs/observability-root-shared/metric-contract';
import { MUTATION_REPLAYS_METRIC } from '@pkgs/observability-root-shared/mutation-metrics';

const GROUPS = [
  'sync',
  'session',
  'room',
  'billing',
  'media',
  'app',
  'telemetry',
  'machine',
];

describe('the request metrics', () => {
  test('count and time requests by method, status class and route group', () => {
    const { requests, duration } = httpMetricContracts(GROUPS);
    expect(Object.keys(requests.dimensions)).toEqual([
      'http.request.method',
      'app.http.status_class',
      'app.http.route_group',
    ]);
    expect(duration.dimensions).toEqual(requests.dimensions);
    expect(requests).toMatchObject({
      name: 'http.server.requests',
      type: 'counter',
    });
    expect(duration).toMatchObject({
      name: 'http.server.request.duration',
      type: 'histogram',
      unit: 's',
    });
  });

  test('fit the series budget with eight route groups', () => {
    const { requests } = httpMetricContracts(GROUPS);
    const combinations = Object.values(requests.dimensions).reduce(
      (total, values) => total * values.length,
      1
    );
    expect(combinations).toBe(HTTP_METHODS.length * 5 * 8);
    expect(combinations).toBeLessThanOrEqual(SERIES_BUDGET);
  });

  test('refuse more route groups than the budget has room for', () => {
    const many = Array.from({ length: 9 }, (_, i) => `group${String(i)}`);
    expect(() => createHttpMetrics(many)).toThrow('series budget');
  });

  test('use only dimensions the SDK keeps', () => {
    for (const key of Object.keys(
      httpMetricContracts(GROUPS).requests.dimensions
    )) {
      expect(METRIC_DIMENSION_KEYS).toContain(
        key as (typeof METRIC_DIMENSION_KEYS)[number]
      );
    }
    for (const key of Object.keys(MUTATION_REPLAYS_METRIC.dimensions)) {
      expect(METRIC_DIMENSION_KEYS).toContain(
        key as (typeof METRIC_DIMENSION_KEYS)[number]
      );
    }
  });
});

describe('histogram boundaries', () => {
  test('are ascending and start at zero, in seconds for durations', () => {
    expect(HISTOGRAM_BOUNDARIES[0]).toBe(0);
    expect([...HISTOGRAM_BOUNDARIES]).toEqual(
      [...HISTOGRAM_BOUNDARIES].sort((a, b) => a - b)
    );
    for (const bound of [0.1, 0.25, 0.5, 1, 2.5, 5]) {
      expect(HISTOGRAM_BOUNDARIES).toContain(bound);
    }
  });
});
