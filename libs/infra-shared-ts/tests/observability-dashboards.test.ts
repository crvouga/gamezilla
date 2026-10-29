import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import { serviceName } from '@libs/product-identity-shared-ts/technical-names';

const directory = join(
  import.meta.dirname,
  '../tofu/modules/observability-views/dashboards'
);

type Panel = {
  id: number;
  title: string;
  targets: { expr: string; datasource: { type: string; uid: string } }[];
};

for (const file of readdirSync(directory).filter((name) =>
  name.endsWith('.json.tftpl')
)) {
  test(`Grafana ${file} has real environment-scoped queries with safe business counting`, () => {
    const source = readFileSync(join(directory, file), 'utf8');
    const rendered = source
      .replaceAll('${environment}', 'example')
      .replaceAll('${namespace}', NAMESPACE)
      .replaceAll('${metrics_uid}', 'metrics')
      .replaceAll('${logs_uid}', 'logs');
    expect(rendered).not.toContain('${');
    const dashboard = JSON.parse(rendered) as { uid: string; panels: Panel[] };
    expect(dashboard.uid).toEndWith('-example');
    expect(dashboard.panels.length).toBeGreaterThan(0);
    expect(new Set(dashboard.panels.map((panel) => panel.id)).size).toBe(
      dashboard.panels.length
    );
    for (const panel of dashboard.panels) {
      expect(panel.title.length).toBeGreaterThan(0);
      expect(panel.targets.length).toBeGreaterThan(0);
      for (const target of panel.targets) {
        expect(['metrics', 'logs']).toContain(target.datasource.uid);
        expect(target.expr).toContain('deployment_environment_name');
        expect(target.expr).not.toMatch(/\b(?:TODO|placeholder|fake)\b/i);
        if (target.expr.includes('count by(event_id)')) {
          if (!panel.title.includes('(all populations)'))
            expect(target.expr).toContain('event_synthetic="false"');
          expect(target.expr).toContain('count_over_time');
        }
        if (target.expr.includes('unwrap'))
          expect(target.expr).toContain('__error__=""');
      }
    }
  });
}

test('dashboards query services by the namespace their telemetry carries', () => {
  const services = new Set<string>();
  for (const file of readdirSync(directory)) {
    const source = readFileSync(join(directory, file), 'utf8');
    for (const [, name] of source.matchAll(
      /(?:job|service_name)=\\"([^"\\]+)\\"/g
    ))
      if (name !== undefined) services.add(name);
  }
  expect([...services].sort()).toEqual([
    '${namespace}-client',
    '${namespace}-server',
  ]);
  expect(
    [...services].map((name) => name.replace('${namespace}', NAMESPACE)).sort()
  ).toEqual([serviceName('client'), serviceName('server')]);
});
