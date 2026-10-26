import { describe, expect, test } from 'bun:test';
import {
  indicatorFor,
  metricIndicators,
} from '@libs/observability-shared-ts/slo-indicators';
import {
  badCount,
  bucketLabel,
  burnExpression,
  numberText,
  sampleSelector,
  sloRatioQuery,
  windowQueries,
} from '@libs/observability-shared-ts/slo-promql';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

function indicator(sli: string) {
  const found = indicatorFor(sli);
  if (found === undefined) throw new Error(`no metric indicator ${sli}`);
  return found;
}

/** A counter's count: growth of the series that existed, plus first values of new ones. */
const count = (selector: string, window: string, sum = 'sum') => {
  const grown = `${sum}(increase(${selector}[${window}]))`;
  const first = `${sum}(min_over_time(${selector}[${window}]) unless min_over_time(${selector}[${window}] offset ${window}))`;
  return `((${grown} + ${first}) or ${grown} or ${first})`;
};

describe('the queries of an availability indicator', () => {
  const queries = windowQueries({
    indicator: indicator('people-requests-served'),
    window: '1h',
    environment: 'prd',
  });

  test('count people requests, and the good ones by what is not a failure', () => {
    expect(queries.total).toBe(
      count(
        'http_server_requests_total{deployment_environment_name="prd",app_http_route_group=~"sync|session|room|billing|media|app"}',
        '1h'
      )
    );
    expect(queries.good).toBe(
      count(
        'http_server_requests_total{deployment_environment_name="prd",app_http_route_group=~"sync|session|room|billing|media|app",app_http_status_class!="5xx"}',
        '1h'
      )
    );
  });
});

describe('the queries of a speed indicator', () => {
  test('count requests at or under the bound by the bucket, out of every request', () => {
    const queries = windowQueries({
      indicator: indicator('saves-and-loads-answered-within-half-a-second'),
      window: '5m',
      environment: 'dev',
    });
    expect(queries.good).toBe(
      count(
        'http_server_request_duration_seconds_bucket{deployment_environment_name="dev",app_http_route_group="sync",le="0.5"}',
        '5m'
      )
    );
    expect(queries.total).toBe(
      count(
        'http_server_request_duration_seconds_count{deployment_environment_name="dev",app_http_route_group="sync"}',
        '5m'
      )
    );
  });

  test('read a whole-second bound as the bucket label the backend prints', () => {
    expect(bucketLabel(1)).toBe('"1"');
    expect(bucketLabel(2.5)).toBe('"2.5"');
    expect(bucketLabel(0.005)).toBe('"0.005"');
  });
});

describe('the queries of a check from outside', () => {
  test('count the samples that read 1 out of every sample', () => {
    const queries = windowQueries({
      indicator: indicator('sign-in-checks-passing'),
      window: '12h',
      environment: 'prd',
    });
    const samples =
      'synthetic_check_result{deployment_environment_name="prd",app_synthetic_check="auth.sign-in"}[12h]';
    expect(queries.good).toBe(`sum(sum_over_time(${samples}))`);
    expect(queries.total).toBe(`sum(count_over_time(${samples}))`);
  });

  test('read every sample of the window for the time slices', () => {
    expect(
      sampleSelector({
        indicator: indicator('outside-pings-answered'),
        window: '604800s',
        environment: 'prd',
      })
    ).toBe('probe_success{job=~"(app-shell|api-ready)-prd"}[604800s]');
  });

  test('refuse to read the samples of a counter', () => {
    expect(() =>
      sampleSelector({
        indicator: indicator('people-requests-served'),
        window: '1h',
        environment: 'prd',
      })
    ).toThrow('is not a share of samples');
  });
});

describe('the ratio a Grafana SLO evaluates', () => {
  test('groups by the slice, so one failing route group shows apart', () => {
    expect(
      sloRatioQuery({
        indicator: indicator('people-requests-served'),
        environment: '__ENVIRONMENT__',
      })
    ).toBe(
      '((sum by (app_http_route_group)(rate(http_server_requests_total{deployment_environment_name="__ENVIRONMENT__",app_http_route_group=~"sync|session|room|billing|media|app",app_http_status_class!="5xx"}[$__rate_interval]))) or (sum by (app_http_route_group)(rate(http_server_requests_total{deployment_environment_name="__ENVIRONMENT__",app_http_route_group=~"sync|session|room|billing|media|app"}[$__rate_interval]))) * 0) / (sum by (app_http_route_group)(rate(http_server_requests_total{deployment_environment_name="__ENVIRONMENT__",app_http_route_group=~"sync|session|room|billing|media|app"}[$__rate_interval])))'
    );
  });

  test('groups a check from outside by its check', () => {
    expect(
      sloRatioQuery({
        indicator: indicator('game-journeys-passing'),
        environment: 'prd',
      })
    ).toStartWith('((sum by (app_synthetic_check)(sum_over_time(');
  });

  test('reads a probe duration against its bound, minute by minute', () => {
    expect(
      sloRatioQuery({
        indicator: indicator('outside-pings-answered-within-a-second'),
        environment: 'prd',
      })
    ).toBe(
      '((sum by (job)(sum_over_time((probe_duration_seconds{job=~"(app-shell|api-ready)-prd"} <= bool 1)[$__rate_interval:1m]))) or (sum by (job)(count_over_time(probe_duration_seconds{job=~"(app-shell|api-ready)-prd"}[$__rate_interval:1m]))) * 0) / (sum by (job)(count_over_time(probe_duration_seconds{job=~"(app-shell|api-ready)-prd"}[$__rate_interval:1m])))'
    );
  });
});

describe('a count split by slice', () => {
  test('keeps one series per slice, and a slice with only one part of the count', () => {
    const { total } = windowQueries({
      indicator: indicator('people-requests-served'),
      window: '1h',
      environment: 'prd',
      by: 'app_http_route_group',
    });
    expect(total).toBe(
      count(
        'http_server_requests_total{deployment_environment_name="prd",app_http_route_group=~"sync|session|room|billing|media|app"}',
        '1h',
        'sum by (app_http_route_group)'
      )
    );
  });

  test('counts the bad events as all less the good, a slice with none good included', () => {
    expect(badCount({ good: 'G', total: 'T' })).toBe(
      '((T) - ((G) or (T) * 0))'
    );
  });
});

describe('a check every environment runs', () => {
  test('selects its environment by the job name, never a label its points may lack', () => {
    const { total } = windowQueries({
      indicator: indicator('broker-pings-answered'),
      window: '1h',
      environment: 'dev',
    });
    expect(total).toBe(
      'sum(count_over_time(probe_success{job=~"(broker)-dev"}[1h]))'
    );
  });

  test('counts a duration within its bound sample by sample', () => {
    const { good } = windowQueries({
      indicator: indicator(
        'outside-pings-answered-within-two-and-a-half-seconds'
      ),
      window: '5m',
      environment: 'prd',
    });
    expect(good).toBe(
      'sum(sum_over_time((probe_duration_seconds{job=~"(app-shell|api-ready)-prd"} <= bool 2.5)[5m:1m]))'
    );
  });
});

describe('every generated query', () => {
  test('selects its environment, so environments on one stack never mix', () => {
    assertProperty(
      'queries select their environment',
      fc.property(
        fc.constantFrom(...metricIndicators()),
        fc.constantFrom('5m', '1h', '3d', '604800s'),
        fc.stringMatching(/^[a-z]{2,6}$/),
        (each, window, environment) => {
          const { good, total } = windowQueries({
            indicator: each,
            window,
            environment,
          });
          for (const query of [good, total]) {
            const byLabel = query.includes(
              `deployment_environment_name=${JSON.stringify(environment)}`
            );
            const byJob = query.includes(`)-${environment}"}`);
            expect(byLabel || byJob).toBe(true);
            expect(query).not.toContain('target_info');
            expect(query).toContain(`[${window}`);
          }
        }
      )
    );
  });

  test('escapes a hostile environment name rather than splicing it in', () => {
    const { total } = windowQueries({
      indicator: indicator('people-requests-served'),
      window: '1h',
      environment: 'a"} or vector(1) #',
    });
    expect(total).toContain(
      'deployment_environment_name="a\\"} or vector(1) #"'
    );
  });
});

describe('the burn expression', () => {
  test('is the bad share over the share the objective allows', () => {
    const queries = { good: 'G', total: 'T' };
    // A slice in which nothing was good (G missing) burns at its fastest.
    expect(burnExpression({ queries, target: 0.999 })).toBe(
      '((1 - ((G) or (T) * 0) / (T)) / 0.001)'
    );
    expect(burnExpression({ queries, target: 0.95 })).toBe(
      '((1 - ((G) or (T) * 0) / (T)) / 0.05)'
    );
  });

  test('prints no float noise', () => {
    expect(numberText(1 - 0.999)).toBe('0.001');
    expect(numberText(1 - 0.99)).toBe('0.01');
    expect(numberText(14.4)).toBe('14.4');
  });
});
