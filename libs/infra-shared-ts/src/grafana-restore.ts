import { inGrafanaScope } from './grafana-retirement';
import type { PlanJson } from './plan-policy';
import type { PlanOptions, Target, TofuPaths } from './tofu-command';
import { planArgs, stackDir, varFileArgs } from './tofu-command';

/**
 * Restoring a Grafana instance that comes back from archive. While archived,
 * foundation forgot its views account and views but Grafana kept them
 * (`grafana-retirement.ts`), and Grafana refuses to create them a second time.
 * `stacks/foundation/observability-views.tf` adopts what was kept, driven by
 * `var.grafana_restore`: pass "account" imports the account and creates its
 * token, then pass "views" uses that token to import the kept views named in
 * `var.grafana_adopt`. Grafana does not always keep the account; when its
 * search finds none, the account pass creates a fresh one instead.
 *
 * The steps are read from the state-only Grafana scope plan
 * (`grafanaRetirementArgs`), never from the fully refreshed plan: refreshing
 * a view needs a token that can read it, which is what the restore provides.
 */
const ACCOUNT = 'grafana_cloud_stack_service_account.views';
const TOKEN = 'grafana_cloud_stack_service_account_token.views';
const VIEWS = 'module.observability_views[';

/** The variable each restore pass sets (`TF_VAR_grafana_restore`). */
export type GrafanaRestorePass = 'account' | 'views';

export function grafanaRestoreEnv(
  env: Record<string, string>,
  pass: GrafanaRestorePass,
  adopt: readonly string[] = []
): Record<string, string> {
  if (pass === 'account') return { ...env, TF_VAR_grafana_restore: pass };
  return {
    ...env,
    TF_VAR_grafana_restore: pass,
    TF_VAR_grafana_adopt: JSON.stringify(adopt),
  };
}

export type GrafanaRestore = {
  /**
   * Views Grafana created whose read-back failed: the create left them
   * tainted in state. With `destroy = false` a replace forgets and recreates,
   * and Grafana refuses a second folder of the same uid, so they are untainted
   * and refreshed instead (Release 42779170490, 42794639115).
   */
  readonly untaint: readonly string[];
  /** The account is not in state: adopt the kept one or create it. */
  readonly account: boolean;
  /** Views not in state, which the views pass imports if Grafana kept them. */
  readonly adopt: readonly string[];
};

export function grafanaRestore(scope: PlanJson): GrafanaRestore {
  const managed = (scope.resource_changes ?? []).filter(
    (resource) =>
      resource.mode === 'managed' && inGrafanaScope(resource.address)
  );
  const creates = (actions: readonly string[]) =>
    actions.length === 1 && actions[0] === 'create';
  return {
    untaint: managed
      .filter(
        (resource) =>
          resource.address.startsWith(VIEWS) &&
          resource.action_reason === 'replace_because_tainted'
      )
      .map((resource) => resource.address),
    account: managed.some(
      (resource) =>
        resource.address === `${ACCOUNT}[0]` && creates(resource.change.actions)
    ),
    adopt: managed
      .filter(
        (resource) =>
          resource.address.startsWith(VIEWS) && creates(resource.change.actions)
      )
      .map((resource) => resource.address),
  };
}

export function needsGrafanaRestore(restore: GrafanaRestore): boolean {
  return (
    restore.untaint.length > 0 || restore.account || restore.adopt.length > 0
  );
}

/**
 * Flags `tofu untaint` accepts (`tofu untaint -help`). It edits state only and
 * prompts for nothing, so it has no `-input`: passing one fails the command.
 */
export const UNTAINT_FLAGS = [
  '-allow-missing',
  '-lock',
  '-lock-timeout',
  '-var',
  '-var-file',
  '-ignore-remote-version',
  '-no-color',
] as const;

/** Clears the taint on one view; state only, never a remote change. */
export function grafanaUntaintArgs(
  paths: TofuPaths,
  target: Target,
  address: string
): readonly string[] {
  if (target.stack !== 'foundation')
    throw new Error('Grafana restore requires the foundation stack');
  if (!address.startsWith(VIEWS))
    throw new Error(`Grafana restore untaints only views, not ${address}`);
  return [
    `-chdir=${stackDir(paths, target.stack)}`,
    'untaint',
    ...varFileArgs(paths, target),
    address,
  ];
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
    // The lookup the account's import reads, named so -target keeps it.
    '-target=data.http.kept_account',
    `-target=${ACCOUNT}`,
    `-target=${TOKEN}`,
  ];
}

/**
 * The account pass may adopt the account (or create it when Grafana kept
 * none) and create a token, nothing else. The import block fires whenever
 * Grafana's search finds the account, so a plain create means nothing was
 * kept; if the search ever missed one, Grafana refuses the create (400).
 */
export function grafanaRestoreAccountDenials(
  plan: PlanJson
): readonly string[] {
  return (plan.resource_changes ?? []).flatMap((resource) => {
    if (resource.mode !== 'managed') return [];
    const actions = resource.change.actions;
    if (actions.every((action) => action === 'no-op' || action === 'update'))
      return [];
    const creates = actions.length === 1 && actions[0] === 'create';
    if (creates && resource.address === `${ACCOUNT}[0]`) return [];
    if (creates && resource.address.startsWith(`${TOKEN}[`)) return [];
    return [
      `${resource.address}: the Grafana restore account pass permits only adopting the account and creating its token`,
    ];
  });
}
