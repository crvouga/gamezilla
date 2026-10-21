import { describe, expect, test } from 'bun:test';
import { parseObjectiveFiles } from '@libs/observability-shared/objective-files';
import {
  catalogIssues,
  indicatorIssues,
} from '@libs/observability-shared/slo-checks';
import type {
  CounterRatioIndicator,
  Indicator,
  MetricIndicator,
} from '@libs/observability-shared/slo-indicators';
import {
  INDICATORS,
  indicatorFor,
} from '@libs/observability-shared/slo-indicators';
import { objectiveFiles } from './specs';

function counterRatio(sli: string): CounterRatioIndicator {
  const found = metric(sli);
  if (found.kind !== 'counter-ratio') throw new Error(`${sli} is not a ratio`);
  return found;
}

function metric(sli: string): MetricIndicator {
  const found = indicatorFor(sli);
  if (found === undefined || found.kind === 'health-job-history') {
    throw new Error(`no metric indicator ${sli}`);
  }
  return found;
}

describe('the live objective files and the indicator catalog', () => {
  test('agree: every live indicator is bound, every binding is used', () => {
    expect(catalogIssues(objectiveFiles())).toEqual([]);
  });

  test('bind every live indicator the repository has, and only those', () => {
    const live = objectiveFiles()
      .filter((file) => file.live)
      .flatMap((file) => file.doc.slos.map((slo) => slo.indicator));
    expect([...new Set(live)].sort()).toEqual(
      INDICATORS.map((i) => i.sli).sort()
    );
  });

  test('keep the harness-measured objectives out of the catalog', () => {
    for (const file of objectiveFiles().filter((f) => !f.live)) {
      for (const sli of file.doc.slis)
        expect(indicatorFor(sli.name)).toBeUndefined();
    }
  });
});

// A `# live` objective file whose indicator the catalog does not know would
// pass its schema and measure nothing.
describe('a live objective with no instrument behind it', () => {
  const unbound = parseObjectiveFiles([
    {
      path: 'specs/runtime/new-promise.openslo.yaml',
      text: `# live
apiVersion: openslo/v1
kind: SLI
metadata:
  name: new-promise-kept
spec:
  ratioMetric:
    counter: true
    good:
      metricSource: { type: product, spec: { measures: kept } }
    total:
      metricSource: { type: product, spec: { measures: asked } }
---
apiVersion: openslo/v1
kind: SLO
metadata:
  name: new-promise
spec:
  service: runtime
  indicatorRef: new-promise-kept
  timeWindow:
    - duration: 28d
      isRolling: true
  budgetingMethod: Occurrences
  objectives:
    - displayName: kept
      target: 0.99
`,
    },
  ]);

  test('is reported with the file to edit', () => {
    const issues = catalogIssues([...objectiveFiles(), ...unbound]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain(
      'specs/runtime/new-promise.openslo.yaml: SLO new-promise uses indicator new-promise-kept'
    );
    expect(issues[0]).toContain('slo-indicators.ts');
  });

  test('and a binding no live objective uses is reported too', () => {
    const withoutSpeed = objectiveFiles().filter(
      (file) => !file.path.endsWith('request-speed.openslo.yaml')
    );
    const issues = catalogIssues(withoutSpeed);
    expect(issues).toContain(
      'the catalog binds indicator people-requests-answered-within-half-a-second, which no SLO of a live objective file uses'
    );
  });

  test('a harness file marked live-only in the catalog is reported', () => {
    const asHarness = objectiveFiles().map((file) =>
      file.path.endsWith('request-success.openslo.yaml')
        ? { ...file, live: false }
        : file
    );
    expect(
      catalogIssues(asHarness).some((i) => i.includes('is not marked "# live"'))
    ).toBe(true);
  });
});

describe('an indicator whose instrument is wrong', () => {
  const served = counterRatio('people-requests-served');
  const fast = metric('people-requests-answered-within-half-a-second');

  test('a real indicator is clean', () => {
    for (const each of INDICATORS) {
      if (each.kind !== 'health-job-history')
        expect(indicatorIssues(each)).toEqual([]);
    }
  });

  test('a metric nobody emits', () => {
    expect(
      indicatorIssues({ ...served, metric: 'http.server.errors' })
    ).toEqual([
      'people-requests-served: no emitted metric named http.server.errors',
    ]);
  });

  test('a ratio over a histogram', () => {
    expect(
      indicatorIssues({ ...served, metric: 'http.server.request.duration' })
    ).toContain(
      'people-requests-served: counter-ratio needs a counter, but http.server.request.duration is a histogram'
    );
  });

  test('a dimension the metric does not have', () => {
    const bad: Indicator = {
      ...served,
      scope: [{ dimension: 'user.id', op: 'is', values: ['x'] }],
    };
    const [issue] = indicatorIssues(bad as MetricIndicator);
    expect(issue).toContain('http.server.requests has no dimension user.id');
  });

  test('a value the dimension never takes', () => {
    const bad: MetricIndicator = {
      ...served,
      good: [
        { dimension: 'app.http.status_class', op: 'is-not', values: ['6xx'] },
      ],
    };
    expect(indicatorIssues(bad)).toEqual([
      'people-requests-served: app.http.status_class is never "6xx" (it is one of 1xx, 2xx, 3xx, 4xx, 5xx)',
    ]);
  });

  test('a route group that does not exist', () => {
    const bad: MetricIndicator = {
      ...served,
      scope: [
        {
          dimension: 'app.http.route_group',
          op: 'is',
          values: ['sync', 'syncing'],
        },
      ],
    };
    expect(indicatorIssues(bad)[0]).toContain('is never "syncing"');
  });

  test('an indicator in which every event is good', () => {
    expect(indicatorIssues({ ...served, good: [] })).toEqual([
      'people-requests-served: every event would be good; name what makes one good',
    ]);
  });

  test('a latency bound between two buckets', () => {
    const issues = indicatorIssues({
      ...fast,
      underSeconds: 0.6,
    } as MetricIndicator);
    expect(issues[0]).toContain(
      '0.6s is not a bucket boundary, so no series counts "at most 0.6s"'
    );
  });

  test('every latency bound the catalog uses is a bucket boundary of the histogram', () => {
    for (const each of INDICATORS) {
      if (each.kind === 'histogram-under')
        expect(indicatorIssues(each)).toEqual([]);
    }
  });
});
