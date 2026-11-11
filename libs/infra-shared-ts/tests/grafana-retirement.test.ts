import { expect, test } from 'bun:test';
import {
  grafanaRetirementArgs,
  grafanaRetirementDenials,
  hasGrafanaRetirement,
} from '@libs/infra-shared-ts/grafana-retirement';
import type { PlanJson } from '@libs/infra-shared-ts/plan-policy';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

function plan(address: string, actions: readonly string[]): PlanJson {
  return {
    resource_changes: [
      { address, mode: 'managed', type: 'grafana_folder', change: { actions } },
    ],
  };
}

// regression: archived-grafana-orphan-refresh
// Release 40954909687: archived instance + existing folder + count=0.
test('archived folder is forgotten without refreshing its unavailable API', () => {
  const input = plan('module.observability_views[0].grafana_folder.this', [
    'forget',
  ]);
  expect(hasGrafanaRetirement(input)).toBe(true);
  expect(grafanaRetirementDenials(input)).toEqual([]);
  expect(
    grafanaRetirementArgs(
      { tofuDir: 'infra', cacheDir: 'cache' },
      { stack: 'foundation', env: 'dev' }
    )
  ).toContain('-refresh=false');
});

test('retirement never permits a remote mutation or an unrelated forget', () => {
  assertProperty(
    'Grafana retirement cannot mutate remote infrastructure',
    fc.property(
      fc.constantFrom('create', 'update', 'delete', 'forget'),
      fc.string({ minLength: 1 }),
      (action, address) => {
        if (action !== 'forget') {
          expect(
            grafanaRetirementDenials(
              plan('module.observability_views[0].grafana_folder.this', [
                action,
              ])
            )
          ).toHaveLength(1);
        }
        expect(
          grafanaRetirementDenials(plan(`module.database.${address}`, [action]))
        ).toHaveLength(1);
      }
    )
  );
});

test('no-op plans need no retirement and mixed plans fail closed', () => {
  expect(
    hasGrafanaRetirement(
      plan('module.observability_views[0].grafana_folder.this', ['no-op'])
    )
  ).toBe(false);
  expect(
    grafanaRetirementDenials(
      plan('module.observability_views[0].grafana_folder.this', [
        'forget',
        'create',
      ])
    )
  ).toHaveLength(1);
  expect(() =>
    grafanaRetirementArgs(
      { tofuDir: 'infra', cacheDir: 'cache' },
      { stack: 'edge', env: 'dev' }
    )
  ).toThrow();
});

// regression: grafana-retirement-on-active-instance
// Release 42794639115: an active prd instance replaced a tainted folder
// (forget + create under `destroy = false`) beside views to create; any
// forget counted as an archive and the retirement refused every view.
test('only an archive, which plans pure forgets, is a retirement', () => {
  const changes = (
    entries: readonly (readonly [string, readonly string[]])[]
  ): PlanJson => ({
    resource_changes: entries.map(([address, actions]) => ({
      address,
      mode: 'managed',
      type: 'grafana_folder',
      change: { actions },
    })),
  });
  const folder = 'module.observability_views[0].grafana_folder.this';
  const dashboard =
    'module.observability_views[0].grafana_dashboard.this["dashboards/product.json.tftpl"]';
  expect(
    hasGrafanaRetirement(
      changes([
        [folder, ['forget', 'create']],
        [dashboard, ['create']],
      ])
    )
  ).toBe(false);
  // A view dropped from code on an active instance is no archive either.
  expect(
    hasGrafanaRetirement(
      changes([
        [dashboard, ['forget']],
        ['grafana_cloud_stack_service_account.views[0]', ['create']],
      ])
    )
  ).toBe(false);
  // Outside the Grafana scope a forget is the ordinary plan's business.
  expect(
    hasGrafanaRetirement(
      changes([['module.database.neon_branch.this', ['forget']]])
    )
  ).toBe(false);
  expect(
    hasGrafanaRetirement(
      changes([
        [folder, ['forget']],
        [dashboard, ['forget']],
        ['grafana_cloud_stack_service_account_token.views[0]', ['forget']],
      ])
    )
  ).toBe(true);
});
