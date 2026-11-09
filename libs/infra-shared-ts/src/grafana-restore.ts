import type { PlanJson } from './plan-policy';
import type { PlanOptions, Target, TofuPaths } from './tofu-command';
import { planArgs } from './tofu-command';

/**
 * Restoring a Grafana instance that comes back from archive. While archived,
 * foundation forgot its observability account and views but Grafana kept them
 * (`grafana-retirement.ts`), and Grafana refuses to create them a second time.
 * `stacks/foundation/observability-views.tf` adopts what was kept, driven by
 * `var.grafana_restore`: pass "account" imports the account and creates its
 * token, then pass "views" uses that token to import the kept views.
 */
const ACCOUNT = 'grafana_cloud_stack_service_account.observability';
const TOKEN = 'grafana_cloud_stack_service_account_token.observability';

/** The variable each restore pass sets (`TF_VAR_grafana_restore`). */
export type GrafanaRestorePass = 'account' | 'views';

export function grafanaRestoreEnv(
  env: Record<string, string>,
  pass: GrafanaRestorePass
): Record<string, string> {
  return { ...env, TF_VAR_grafana_restore: pass };
}

/** A plan that creates the observability account is a restore. */
export function needsGrafanaRestore(plan: PlanJson): boolean {
  return (plan.resource_changes ?? []).some(
    (resource) =>
      resource.address === `${ACCOUNT}[0]` &&
      resource.change.actions.includes('create')
  );
}

/** The account pass touches only the account and its token. */
export function grafanaRestoreAccountArgs(
  paths: TofuPaths,
  target: Target,
  options?: PlanOptions
): readonly string[] {
  if (target.stack !== 'foundation')
    throw new Error('Grafana restore requires the foundation stack');
  return [
    ...planArgs(paths, target, options),
    `-target=${ACCOUNT}`,
    `-target=${TOKEN}`,
  ];
}

/** The account pass may adopt the account and create a token, nothing else. */
export function grafanaRestoreAccountDenials(
  plan: PlanJson
): readonly string[] {
  return (plan.resource_changes ?? []).flatMap((resource) => {
    if (resource.mode !== 'managed') return [];
    const actions = resource.change.actions;
    if (actions.every((action) => action === 'no-op' || action === 'update'))
      return [];
    if (
      resource.address.startsWith(`${TOKEN}[`) &&
      actions.length === 1 &&
      actions[0] === 'create'
    )
      return [];
    return [
      `${resource.address}: the Grafana restore account pass permits only adopting the account and creating its token`,
    ];
  });
}
