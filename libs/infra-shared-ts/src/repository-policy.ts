import type { PlanJson } from './plan-policy';
import type { Stack, TofuPaths } from './tofu-command';
import { planArgs, tofuCredentialEnvironment } from './tofu-command';

const TARGET = { stack: 'bootstrap' as const, env: null };
/** Variables depend on cloud identity resources, so CI deliberately leaves them to bootstrap. */
export const REPOSITORY_POLICY_TARGETS = [
  'module.repository.github_repository.this',
  'module.repository.github_branch_default.main',
  'module.repository.github_repository_ruleset.main',
  'module.repository.github_actions_repository_permissions.this',
  'module.repository.github_workflow_repository_permissions.this',
  'module.repository.github_repository_vulnerability_alerts.this',
  'module.repository.github_repository_dependabot_security_updates.this',
  'module.repository.github_repository_environment.this',
  'module.repository.github_repository_environment_deployment_policy.main',
] as const;

export function validateRepositoryPolicy(command: string, stack: Stack): void {
  if (stack !== 'bootstrap' || !['plan', 'apply', 'drift'].includes(command))
    throw new Error(
      '--repository-policy requires plan/apply/drift --stack bootstrap'
    );
}

export function repositoryPolicyPlanArgs(paths: TofuPaths): readonly string[] {
  return [
    ...planArgs(paths, TARGET),
    ...REPOSITORY_POLICY_TARGETS.map((address) => `-target=${address}`),
  ];
}

/** Only GitHub and encrypted state are in this provider graph. */
export function repositoryPolicyEnvironment(
  secrets: Readonly<Record<string, string | undefined>>,
  paths: TofuPaths
) {
  const result = tofuCredentialEnvironment(secrets, paths, TARGET, {
    TF_VAR_state_passphrase: 'TOFU_STATE_PASSPHRASE',
    AWS_ACCESS_KEY_ID: 'TOFU_STATE_ACCESS_KEY_ID',
    AWS_SECRET_ACCESS_KEY: 'TOFU_STATE_SECRET_ACCESS_KEY',
    GITHUB_TOKEN: 'GITHUB_ADMIN_TOKEN',
  });
  // Required by the bootstrap variable schema, unused by the selected graph.
  result.env['TF_VAR_infisical_token'] = '';
  return result;
}

/** Targeting is not a security boundary: independently inspect the saved plan. */
export function repositoryPolicyDenials(plan: PlanJson): readonly string[] {
  return (plan.resource_changes ?? []).flatMap((resource) => {
    if (resource.mode !== 'managed') return [];
    const actions = resource.change.actions;
    if (actions.length === 1 && actions[0] === 'no-op') return [];
    const inScope = REPOSITORY_POLICY_TARGETS.some(
      (target) =>
        resource.address === target || resource.address.startsWith(`${target}[`)
    );
    if (
      inScope &&
      actions.length === 1 &&
      ['create', 'update'].includes(actions[0] ?? '')
    )
      return [];
    return [
      `${resource.address}: repository policy permits only scoped creation or in-place updates`,
    ];
  });
}
