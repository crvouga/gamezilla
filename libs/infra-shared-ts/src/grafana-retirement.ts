import type { PlanJson } from './plan-policy';
import type { PlanOptions, Target, TofuPaths } from './tofu-command';
import { planArgs } from './tofu-command';

/**
 * The Grafana scope: the views and the account whose token reads them. The
 * release plans it state-only first, to retire an archived instance or to
 * restore one that came back (`grafana-restore.ts`).
 */
export const GRAFANA_SCOPE = [
  'module.observability_views',
  'grafana_cloud_stack_service_account.views',
  'grafana_cloud_stack_service_account_token.views',
] as const;

export function inGrafanaScope(address: string): boolean {
  return GRAFANA_SCOPE.some(
    (scope) =>
      address === scope ||
      address.startsWith(`${scope}[`) ||
      address.startsWith(`${scope}.`)
  );
}

/** Only this state-only retirement skips refresh; the release plan never does. */
export function grafanaRetirementArgs(
  paths: TofuPaths,
  target: Target,
  options?: PlanOptions
) {
  if (target.stack !== 'foundation')
    throw new Error('Grafana retirement requires the foundation stack');
  return [
    ...planArgs(paths, target, options),
    '-refresh=false',
    ...GRAFANA_SCOPE.map((address) => `-target=${address}`),
  ];
}

/**
 * An archived instance sets every count in the scope to 0, so the plan only
 * forgets. A forget beside a create is not an archive: an active instance
 * replacing a tainted view with `destroy = false` plans forget + create
 * (Release 42794639115), and the release must restore it instead.
 */
export function hasGrafanaRetirement(plan: PlanJson): boolean {
  const scoped = (plan.resource_changes ?? []).filter(
    (resource) =>
      resource.mode === 'managed' && inGrafanaScope(resource.address)
  );
  return (
    scoped.some(
      (resource) =>
        resource.change.actions.length === 1 &&
        resource.change.actions[0] === 'forget'
    ) && !scoped.some((resource) => resource.change.actions.includes('create'))
  );
}

/** A retirement may never create, update, replace or delete anything remotely. */
export function grafanaRetirementDenials(plan: PlanJson): readonly string[] {
  return (plan.resource_changes ?? []).flatMap((resource) => {
    if (resource.mode !== 'managed') return [];
    const actions = resource.change.actions;
    if (actions.length === 1 && actions[0] === 'no-op') return [];
    if (
      inGrafanaScope(resource.address) &&
      actions.length === 1 &&
      actions[0] === 'forget'
    )
      return [];
    return [
      `${resource.address}: Grafana retirement permits only forgetting archived views and credentials`,
    ];
  });
}
