import type { PlanJson } from './plan-policy';
import type { Target, TofuPaths } from './tofu-command';
import { planArgs } from './tofu-command';

const TARGETS = [
  'module.observability_views',
  'grafana_cloud_stack_service_account.observability',
  'grafana_cloud_stack_service_account_token.observability',
] as const;

/** Only this state-only retirement skips refresh; the release plan never does. */
export function grafanaRetirementArgs(paths: TofuPaths, target: Target) {
  if (target.stack !== 'foundation')
    throw new Error('Grafana retirement requires the foundation stack');
  return [
    ...planArgs(paths, target),
    '-refresh=false',
    ...TARGETS.map((address) => `-target=${address}`),
  ];
}

export function hasGrafanaRetirement(plan: PlanJson): boolean {
  return (plan.resource_changes ?? []).some((resource) =>
    resource.change.actions.includes('forget')
  );
}

/** A retirement may never create, update, replace or delete anything remotely. */
export function grafanaRetirementDenials(plan: PlanJson): readonly string[] {
  return (plan.resource_changes ?? []).flatMap((resource) => {
    if (resource.mode !== 'managed') return [];
    const actions = resource.change.actions;
    if (actions.length === 1 && actions[0] === 'no-op') return [];
    const inScope = TARGETS.some(
      (address) =>
        resource.address.startsWith(`${address}[`) ||
        resource.address.startsWith(`${address}.`) ||
        resource.address === address
    );
    if (inScope && actions.length === 1 && actions[0] === 'forget') return [];
    return [
      `${resource.address}: Grafana retirement permits only forgetting archived views and credentials`,
    ];
  });
}
