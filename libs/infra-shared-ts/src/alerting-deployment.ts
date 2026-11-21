import type { PlanJson } from './plan-policy';
import type { PlanOptions, Stack, TofuPaths } from './tofu-command';
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
  paths: TofuPaths,
  options?: PlanOptions
): readonly string[] {
  return [
    ...planArgs(paths, TARGET, options),
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

// Only the obsolete delivery resources may be deleted; retained alert history,
// integrations and credentials remain protected from replacement or deletion.
const RETIRED_DELIVERY = new Set(
  [
    ...['page', 'push', 'ci'].map((name) => `grafana_oncall_route.${name}`),
    ...['page', 'push'].flatMap((name) => [
      `grafana_oncall_escalation.${name}`,
      `grafana_oncall_escalation_chain.${name}`,
    ]),
    ...[
      'mobile',
      'mobile_wait',
      'important_mobile',
      'important_wait',
      'important_repeat',
    ].map((name) => `grafana_oncall_user_notification_rule.${name}`),
  ].map((name) => `module.alert_routing[0].${name}`)
);

/** A dependency refresh may appear in the plan, but may never change the stack. */
export function alertingDeploymentDenials(plan: PlanJson): readonly string[] {
  return (plan.resource_changes ?? []).flatMap((resource) => {
    if (resource.mode !== 'managed') return [];
    const actions = resource.change.actions;
    if (actions.length === 1 && actions[0] === 'no-op') return [];
    if (
      actions.length === 1 &&
      actions[0] === 'delete' &&
      RETIRED_DELIVERY.has(resource.address)
    )
      return [];
    if (
      inScope(resource.address) &&
      actions.length === 1 &&
      ['create', 'update'].includes(actions[0] ?? '')
    )
      return [];
    return [
      `${resource.address}: alerting permits scoped creation, in-place updates and retirement of obsolete delivery resources`,
    ];
  });
}
