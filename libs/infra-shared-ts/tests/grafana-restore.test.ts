import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  grafanaRestore,
  grafanaRestoreAccountArgs,
  grafanaRestoreAccountDenials,
  grafanaRestoreEnv,
  grafanaUntaintArgs,
  needsGrafanaRestore,
  UNTAINT_FLAGS,
} from '@libs/infra-shared-ts/grafana-restore';
import { hasGrafanaRetirement } from '@libs/infra-shared-ts/grafana-retirement';
import type { PlanJson } from '@libs/infra-shared-ts/plan-policy';

const ACCOUNT = 'grafana_cloud_stack_service_account.views[0]';
const TOKEN = 'grafana_cloud_stack_service_account_token.views[0]';
const FOLDER = 'module.observability_views[0].grafana_folder.this';
const DASHBOARD =
  'module.observability_views[0].grafana_dashboard.this["dashboards/product.json.tftpl"]';
const RULES = 'module.observability_views[0].grafana_rule_group.groups["fast"]';
const SLO =
  'module.observability_views[0].grafana_slo.objectives["people-can-pay"]';
const PATHS = { tofuDir: 'infra', cacheDir: 'cache' };

type Change = readonly [string, readonly string[], string?];

function plan(changes: readonly Change[]): PlanJson {
  return {
    resource_changes: changes.map(([address, actions, reason]) => ({
      address,
      mode: 'managed',
      type: address.split('.').at(-2)?.replace(/\[.*$/, '') ?? '',
      change: { actions },
      ...(reason === undefined ? {} : { action_reason: reason }),
    })),
  };
}

// regression: restored-grafana-preserved-service-account
// Release 42613625809: dev's Grafana instance came back from archive and
// creating the kept observability account answered 400 Bad Request.
test('a scope plan that creates the views account restores it', () => {
  expect(grafanaRestore(plan([[ACCOUNT, ['create']]])).account).toBe(true);
  expect(grafanaRestore(plan([[ACCOUNT, ['no-op']]])).account).toBe(false);
  expect(grafanaRestore(plan([[ACCOUNT, ['forget']]])).account).toBe(false);
  expect(needsGrafanaRestore(grafanaRestore({}))).toBe(false);
});

test('the account pass plans only the account and its token', () => {
  const args = grafanaRestoreAccountArgs(PATHS, {
    stack: 'foundation',
    env: 'dev',
  });
  expect(args.filter((arg) => arg.startsWith('-target='))).toEqual([
    '-target=data.http.kept_account',
    '-target=grafana_cloud_stack_service_account.views',
    '-target=grafana_cloud_stack_service_account_token.views',
  ]);
  expect(() =>
    grafanaRestoreAccountArgs(PATHS, { stack: 'edge', env: 'dev' })
  ).toThrow();
  expect(grafanaRestoreEnv({ A: '1' }, 'account')).toEqual({
    A: '1',
    TF_VAR_grafana_restore: 'account',
  });
  expect(grafanaRestoreEnv({ A: '1' }, 'views', [FOLDER])).toEqual({
    A: '1',
    TF_VAR_grafana_restore: 'views',
    TF_VAR_grafana_adopt: JSON.stringify([FOLDER]),
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
    grafanaRestoreAccountDenials(plan([[ACCOUNT, ['delete', 'create']]]))
  ).toHaveLength(1);
  expect(
    grafanaRestoreAccountDenials(plan([[TOKEN, ['delete', 'create']]]))
  ).toHaveLength(1);
  expect(
    grafanaRestoreAccountDenials(plan([[FOLDER, ['create']]]))
  ).toHaveLength(1);
});

// regression: restored-grafana-without-kept-account
// Release 42746252728: prd's Grafana instance came back from archive without
// the observability account; the search found none, so the account pass
// planned a create and refused it.
test('the account pass creates the account when Grafana kept none', () => {
  expect(
    grafanaRestoreAccountDenials(
      plan([
        [ACCOUNT, ['create']],
        [TOKEN, ['create']],
      ])
    )
  ).toEqual([]);
});

// regression: grafana-restore-tainted-folder
// Release 42779170490 created the prd views folder, could not read it back
// (403 folders:read) and left it tainted; Release 42794639115 then planned
// its replacement (forget + create) beside the views to create, mistook the
// forget for an archive and refused every view. This is that scope plan,
// after the views account moved to its Admin address.
const STUCK_PRD_SCOPE = plan([
  [ACCOUNT, ['create']],
  [TOKEN, ['create']],
  [FOLDER, ['forget', 'create'], 'replace_because_tainted'],
  [DASHBOARD, ['create']],
  [RULES, ['create']],
  [SLO, ['create']],
]);

test('a stuck restore converges: untaint, add the account, adopt what is missing', () => {
  expect(hasGrafanaRetirement(STUCK_PRD_SCOPE)).toBe(false);
  const restore = grafanaRestore(STUCK_PRD_SCOPE);
  expect(restore).toEqual({
    untaint: [FOLDER],
    account: true,
    adopt: [DASHBOARD, RULES, SLO],
  });
  expect(needsGrafanaRestore(restore)).toBe(true);
});

test('a tainted view is untainted even when the account is in state', () => {
  const restore = grafanaRestore(
    plan([
      [ACCOUNT, ['no-op']],
      [TOKEN, ['no-op']],
      [FOLDER, ['forget', 'create'], 'replace_because_tainted'],
    ])
  );
  expect(restore).toEqual({ untaint: [FOLDER], account: false, adopt: [] });
});

test('only a view is ever untainted, through its own state-only command', () => {
  const target = { stack: 'foundation', env: 'prd' } as const;
  const args = grafanaUntaintArgs(PATHS, target, FOLDER);
  expect(args).toContain('untaint');
  expect(args.at(-1)).toBe(FOLDER);
  expect(args.some((arg) => arg.startsWith('-var-file='))).toBe(true);
  // regression: grafana-untaint-input-flag
  // Release 42950298563 failed on prd: `tofu untaint` has no -input flag.
  const flags = args
    .slice(2, -1)
    .map((arg) => arg.slice(0, arg.indexOf('=') >>> 0));
  for (const flag of flags)
    expect(UNTAINT_FLAGS as readonly string[]).toContain(flag);
  expect(args.some((arg) => arg.startsWith('-input'))).toBe(false);
  expect(() => grafanaUntaintArgs(PATHS, target, ACCOUNT)).toThrow();
  expect(() =>
    grafanaUntaintArgs(PATHS, { stack: 'edge', env: 'prd' }, FOLDER)
  ).toThrow();
  // A tainted resource outside the views is not the restore's to clear.
  expect(
    grafanaRestore(
      plan([[TOKEN, ['forget', 'create'], 'replace_because_tainted']])
    ).untaint
  ).toEqual([]);
});

const STACK = readFileSync(
  join(import.meta.dir, '../tofu/stacks/foundation/observability-views.tf'),
  'utf8'
);

test('foundation adopts every kept view only during the views pass', () => {
  for (const to of [
    'grafana_cloud_stack_service_account.views[0]',
    'module.observability_views[0].grafana_folder.this',
    'module.observability_views[0].grafana_dashboard.this[each.key]',
    'module.observability_views[0].grafana_rule_group.groups[each.key]',
    'module.observability_views[0].grafana_slo.objectives[each.key]',
  ])
    expect(STACK).toContain(`= ${to}\n`);
  // Each view import is limited to the addresses the scope plan would create.
  for (const address of [
    '"module.observability_views[0].grafana_folder.this"',
    '"module.observability_views[0].grafana_dashboard.this[%q]"',
    '"module.observability_views[0].grafana_rule_group.groups[%q]"',
    '"module.observability_views[0].grafana_slo.objectives[%q]"',
  ])
    expect(STACK).toContain(address);
  expect(STACK.match(/contains\(var\.grafana_adopt, /g)).toHaveLength(4);
  // A token cannot be imported; a fresh one must not collide with the kept one.
  expect(STACK).toContain('ignore_changes = [name]');
  expect(STACK).toContain('plantimestamp()');
});

// regression: grafana-views-editor-cannot-read-folder
// Grafana 13 grants an API-created folder only to the Admin role, so the
// Editor views account created the prd folder and then got 403 folders:read.
test('the views account is an Admin and the Editor account is retired', () => {
  const account = STACK.slice(
    STACK.indexOf('resource "grafana_cloud_stack_service_account" "views"'),
    STACK.indexOf(
      'resource "grafana_cloud_stack_service_account_token" "views"'
    )
  );
  expect(account).toContain('role       = "Admin"');
  expect(STACK).not.toContain('"Editor"');
  // Forgotten, so the release never waits on an archived instance to delete it.
  for (const from of [
    'grafana_cloud_stack_service_account_token.observability',
    'grafana_cloud_stack_service_account.observability',
  ]) {
    const block = STACK.slice(STACK.indexOf(`from = ${from}\n`));
    expect(block.slice(0, block.indexOf('}\n}'))).toContain('destroy = false');
  }
});
