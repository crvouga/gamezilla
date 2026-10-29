// @io-wall-ok — reads the committed dashboard sources.
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SERVER_SERVICE_NAME } from '@libs/observability-shared-ts/service-names';
import { expressionIssues } from '@libs/observability-shared-ts/slo-checks';
import { REPO_ROOT } from './specs';

const DASHBOARDS = join(
  REPO_ROOT,
  'libs/infra-shared-ts/tofu/modules/observability-views/dashboards'
);

type Panel = {
  title: string;
  targets: { expr: string; datasource: { uid: string } }[];
};

describe('every dashboard query on metrics', () => {
  for (const file of readdirSync(DASHBOARDS).filter((name) =>
    name.endsWith('.json.tftpl')
  )) {
    test(`${file} selects only series the server emits, with labels they carry`, () => {
      const rendered = readFileSync(join(DASHBOARDS, file), 'utf8')
        .replaceAll('${environment}', 'example')
        .replaceAll('${metrics_uid}', 'metrics')
        .replaceAll('${logs_uid}', 'logs');
      const { panels } = JSON.parse(rendered) as { panels: Panel[] };
      const metricTargets = panels.flatMap((panel) =>
        panel.targets
          .filter((target) => target.datasource.uid === 'metrics')
          .map((target) => ({ panel: panel.title, expr: target.expr }))
      );
      const issues = metricTargets.flatMap(({ panel, expr }) =>
        expressionIssues(expr).map((issue) => `${file} / ${panel}: ${issue}`)
      );
      expect(issues).toEqual([]);
    });

    // regression: target-info-join-drops-ended-isolates
    test(`${file} never joins target_info, which drops every isolate that has ended`, () => {
      const source = readFileSync(join(DASHBOARDS, file), 'utf8');
      expect(source).not.toContain('target_info');
    });
  }

  test('are not vacuous: the engineering dashboard really queries request metrics', () => {
    const source = readFileSync(
      join(DASHBOARDS, 'engineering.json.tftpl'),
      'utf8'
    );
    expect(source).toContain('http_server_requests_total');
  });
});

describe('a PromQL expression that drifted from the emitted metrics', () => {
  test.each([
    [
      `rate(http_server_requests_count{job="${SERVER_SERVICE_NAME}"}[5m])`,
      'selects http_server_requests_count, which no emitted metric produces',
    ],
    [
      'sum(http_server_requests_total{app_http_status_klass="5xx"})',
      'has no label app_http_status_klass',
    ],
    [
      'sum(http_server_requests_total{app_http_status_class="6xx"})',
      'is never "6xx"',
    ],
    [
      'sum(http_server_requests_total{app_http_route_group=~"sync|nope"})',
      'is never "nope"',
    ],
  ])('%s is reported', (expr, issue) => {
    expect(expressionIssues(expr).some((i) => i.includes(issue))).toBe(true);
  });

  test('a correct one is not', () => {
    expect(
      expressionIssues(
        `sum(rate(http_server_requests_total{job="${SERVER_SERVICE_NAME}",app_http_status_class="5xx",deployment_environment_name="prd"}[5m]))`
      )
    ).toEqual([]);
  });
});
