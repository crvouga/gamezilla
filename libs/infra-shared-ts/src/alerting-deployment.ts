import type { PlanJson } from './plan-policy';
import type { Stack, TofuPaths } from './tofu-command';
import { planArgs, tofuCredentialEnvironment } from './tofu-command';

const TARGET = { stack: 'bootstrap' as const, env: null };
const RESOURCES = [
  'github_repository_webhook.ci_alerts',
  'grafana_cloud_access_policy.alerting_management',
  'grafana_cloud_access_policy_token.alerting_management',
  'grafana_cloud_access_policy.synthetic_monitoring',
  'grafana_cloud_access_policy_token.synthetic_monitoring',
  'grafana_synthetic_monitoring_installation.this',
  'grafana_cloud_stack_service_account.alerting',
  'grafana_cloud_stack_service_account_token.alerting',
  'grafana_cloud_stack_service_account.alerting_provisioner',
  'grafana_cloud_stack_service_account_token.alerting_provisioner',
] as const;
const MODULES = [
  'module.alert_routing',
  'module.synthetic_monitoring',
] as const;

export function validateAlertingDeployment(
  command: string,
  stack: Stack
): void {
  if (stack !== 'bootstrap' || !['plan', 'apply', 'drift'].includes(command))
    throw new Error('--alerting requires plan/apply/drift --stack bootstrap');
}

export function alertingDeploymentPlanArgs(
  paths: TofuPaths
): readonly string[] {
  return [
    ...planArgs(paths, TARGET),
    ...[...RESOURCES, ...MODULES].map((address) => `-target=${address}`),
  ];
}

/** Grafana, the CI notification webhook and encrypted state only. */
export function alertingDeploymentEnvironment(
  secrets: Readonly<Record<string, string | undefined>>,
  paths: TofuPaths
) {
  const result = tofuCredentialEnvironment(secrets, paths, TARGET, {
    TF_VAR_state_passphrase: 'TOFU_STATE_PASSPHRASE',
    AWS_ACCESS_KEY_ID: 'TOFU_STATE_ACCESS_KEY_ID',
    AWS_SECRET_ACCESS_KEY: 'TOFU_STATE_SECRET_ACCESS_KEY',
    GRAFANA_CLOUD_ACCESS_POLICY_TOKEN: 'GRAFANA_CLOUD_API_TOKEN',
    GITHUB_TOKEN: 'GITHUB_ADMIN_TOKEN',
  });
  result.env['TF_VAR_infisical_token'] = '';
  return result;
}

function inScope(address: string): boolean {
  return (
    RESOURCES.some(
      (target) => address === target || address.startsWith(`${target}[`)
    ) ||
    MODULES.some(
      (target) =>
        address.startsWith(`${target}.`) || address.startsWith(`${target}[`)
    )
  );
}

/** A dependency refresh may appear in the plan, but may never change the stack. */
export function alertingDeploymentDenials(plan: PlanJson): readonly string[] {
  return (plan.resource_changes ?? []).flatMap((resource) => {
    if (resource.mode !== 'managed') return [];
    const actions = resource.change.actions;
    if (actions.length === 1 && actions[0] === 'no-op') return [];
    if (
      inScope(resource.address) &&
      actions.length === 1 &&
      ['create', 'update'].includes(actions[0] ?? '')
    )
      return [];
    return [
      `${resource.address}: alerting permits only scoped creation or in-place updates`,
    ];
  });
}
