import { describe, expect, test } from 'bun:test';
import {
  indicatorFor,
  metricIndicators,
} from '@libs/observability-shared-ts/slo-indicators';
import {
  bucketLabel,
  burnExpression,
  environmentJoin,
  numberText,
  windowQueries,
} from '@libs/observability-shared-ts/slo-promql';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

function indicator(sli: string) {
  const found = indicatorFor(sli);
  if (found === undefined || found.kind === 'health-job-history') {
    throw new Error(`no metric indicator ${sli}`);
  }
  return found;
}

describe('the queries of an availability indicator', () => {
  const queries = windowQueries({
    indicator: indicator('people-requests-served'),
    window: '1h',
    environment: 'prd',
  });

  test('count people requests, and the good ones by what is not a failure', () => {
    expect(queries.total).toBe(
      'sum(increase(http_server_requests_total{job="gamezilla-server",app_http_route_group=~"sync|session|room|billing|media|app"}[1h]) * on(job, instance) group_left target_info{deployment_environment_name="prd"})'
    );
    expect(queries.good).toBe(
      'sum(increase(http_server_requests_total{job="gamezilla-server",app_http_route_group=~"sync|session|room|billing|media|app",app_http_status_class!="5xx"}[1h]) * on(job, instance) group_left target_info{deployment_environment_name="prd"})'
    );
  });
});

describe('the queries of a speed indicator', () => {
  test('count requests at or under the bound by the bucket, out of every request', () => {
    const queries = windowQueries({
      indicator: indicator('people-requests-answered-within-half-a-second'),
      window: '5m',
      environment: 'dev',
    });
    expect(queries.good).toBe(
      'sum(increase(http_server_request_duration_seconds_bucket{job="gamezilla-server",le="0.5",app_http_route_group=~"sync|session|room|billing|app"}[5m]) * on(job, instance) group_left target_info{deployment_environment_name="dev"})'
    );
    expect(queries.total).toBe(
      'sum(increase(http_server_request_duration_seconds_count{job="gamezilla-server",app_http_route_group=~"sync|session|room|billing|app"}[5m]) * on(job, instance) group_left target_info{deployment_environment_name="dev"})'
    );
  });

  test('read a whole-second bound as the bucket label the backend prints', () => {
    expect(bucketLabel(1)).toBe('"1"');
    expect(bucketLabel(2.5)).toBe('"2.5"');
    expect(bucketLabel(0.005)).toBe('"0.005"');
  });
});

describe('every generated query', () => {
  test('joins its environment, so environments on one stack never mix', () => {
    assertProperty(
      'queries select their environment',
      fc.property(
        fc.constantFrom(...metricIndicators()),
        fc.constantFrom('5m', '1h', '3d', '2419200s'),
        fc.stringMatching(/^[a-z]{2,6}$/),
        (each, window, environment) => {
          const { good, total } = windowQueries({
            indicator: each,
            window,
            environment,
          });
          for (const query of [good, total]) {
            expect(query).toContain(environmentJoin(environment));
            expect(query).toContain('job="gamezilla-server"');
            expect(query).toContain(`[${window}]`);
          }
        }
      )
    );
  });

  test('escapes a hostile environment name rather than splicing it in', () => {
    const join = environmentJoin('a"} or vector(1) #');
    expect(join).toContain(
      'deployment_environment_name="a\\"} or vector(1) #"'
    );
  });
});

describe('the burn expression', () => {
  test('is the bad share over the share the objective allows', () => {
    const queries = { good: 'G', total: 'T' };
    expect(burnExpression({ queries, target: 0.999 })).toBe(
      '((1 - G / T) / 0.001)'
    );
    expect(burnExpression({ queries, target: 0.95 })).toBe(
      '((1 - G / T) / 0.05)'
    );
  });

  test('prints no float noise', () => {
    expect(numberText(1 - 0.999)).toBe('0.001');
    expect(numberText(1 - 0.99)).toBe('0.01');
    expect(numberText(14.4)).toBe('14.4');
  });
});
