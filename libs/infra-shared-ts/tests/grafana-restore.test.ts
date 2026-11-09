import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  grafanaRestoreAccountArgs,
  grafanaRestoreAccountDenials,
  grafanaRestoreEnv,
  needsGrafanaRestore,
} from '@libs/infra-shared-ts/grafana-restore';
import type { PlanJson } from '@libs/infra-shared-ts/plan-policy';

const ACCOUNT = 'grafana_cloud_stack_service_account.observability[0]';
const TOKEN = 'grafana_cloud_stack_service_account_token.observability[0]';

function plan(
  changes: readonly (readonly [string, readonly string[]])[]
): PlanJson {
  return {
    resource_changes: changes.map(([address, actions]) => ({
      address,
      mode: 'managed',
      type: address.split('.').at(-2) ?? '',
      change: { actions },
    })),
  };
}

// regression: restored-grafana-preserved-service-account
// Release 42613625809: dev's Grafana instance came back from archive and
// creating the kept observability account answered 400 Bad Request.
test('a plan that recreates the observability account is a restore', () => {
  expect(needsGrafanaRestore(plan([[ACCOUNT, ['create']]]))).toBe(true);
  expect(needsGrafanaRestore(plan([[ACCOUNT, ['no-op']]]))).toBe(false);
  expect(needsGrafanaRestore(plan([[ACCOUNT, ['forget']]]))).toBe(false);
  expect(needsGrafanaRestore({})).toBe(false);
});

test('the account pass plans only the account and its token', () => {
  const args = grafanaRestoreAccountArgs(
    { tofuDir: 'infra', cacheDir: 'cache' },
    { stack: 'foundation', env: 'dev' }
  );
  expect(args.filter((arg) => arg.startsWith('-target='))).toEqual([
    '-target=data.http.kept_account',
    '-target=grafana_cloud_stack_service_account.observability',
    '-target=grafana_cloud_stack_service_account_token.observability',
  ]);
  expect(() =>
    grafanaRestoreAccountArgs(
      { tofuDir: 'infra', cacheDir: 'cache' },
      { stack: 'edge', env: 'dev' }
    )
  ).toThrow();
  expect(grafanaRestoreEnv({ A: '1' }, 'views')).toEqual({
    A: '1',
    TF_VAR_grafana_restore: 'views',
  });
});

test('the account pass adopts the account and creates a token, nothing else', () => {
  // An import shows as a no-op (or an update) on the adopted address.
  expect(
    grafanaRestoreAccountDenials(
      plan([
        [ACCOUNT, ['no-op']],
        [TOKEN, ['create']],
      ])
    )
  ).toEqual([]);
  expect(
    grafanaRestoreAccountDenials(plan([[ACCOUNT, ['create']]]))
  ).toHaveLength(1);
  expect(
    grafanaRestoreAccountDenials(plan([[TOKEN, ['delete', 'create']]]))
  ).toHaveLength(1);
  expect(
    grafanaRestoreAccountDenials(
      plan([['module.observability_views[0].grafana_folder.this', ['create']]])
    )
  ).toHaveLength(1);
});

test('foundation adopts every kept view only during the views pass', () => {
  const stack = readFileSync(
    join(import.meta.dir, '../tofu/stacks/foundation/observability-views.tf'),
    'utf8'
  );
  for (const to of [
    'grafana_cloud_stack_service_account.observability[0]',
    'module.observability_views[0].grafana_folder.this',
    'module.observability_views[0].grafana_dashboard.this[each.key]',
    'module.observability_views[0].grafana_rule_group.groups[each.key]',
    'module.observability_views[0].grafana_slo.objectives[each.key]',
  ])
    expect(stack).toContain(`= ${to}\n`);
  // A token cannot be imported; a fresh one must not collide with the kept one.
  expect(stack).toContain('ignore_changes = [name]');
  expect(stack).toContain('plantimestamp()');
});
