import type { PlanJson } from './plan-policy';
import type { Stack, TofuPaths } from './tofu-command';
import { planArgs, tofuCredentialEnvironment } from './tofu-command';

const TARGET = { stack: 'bootstrap' as const, env: null };
const MODULE = 'module.ci_identity';

/** Recovery is an existing identity update, never a deploy or first bootstrap. */
export function validateCiIdentityRecovery(
  command: string,
  stack: Stack
): void {
  if (stack !== 'bootstrap' || !['plan', 'apply'].includes(command)) {
    throw new Error(
      '--recover-ci-identity requires plan/apply --stack bootstrap'
    );
  }
}

export function ciIdentityRecoveryPlanArgs(
  paths: TofuPaths
): readonly string[] {
  return [...planArgs(paths, TARGET), `-target=${MODULE}`];
}

/** AWS, GitHub and Cloudflare providers are outside the recovery target. */
export function ciIdentityRecoveryEnvironment(
  secrets: Readonly<Record<string, string | undefined>>,
  paths: TofuPaths
) {
  return tofuCredentialEnvironment(secrets, paths, TARGET, {
    TF_VAR_state_passphrase: 'TOFU_STATE_PASSPHRASE',
    AWS_ACCESS_KEY_ID: 'TOFU_STATE_ACCESS_KEY_ID',
    AWS_SECRET_ACCESS_KEY: 'TOFU_STATE_SECRET_ACCESS_KEY',
  });
}

/** Extra scope guard; the normal stateful deletion policy still runs. */
export function ciIdentityRecoveryDenials(plan: PlanJson): readonly string[] {
  return (plan.resource_changes ?? []).flatMap((resource) => {
    if (resource.mode !== 'managed') return [];
    const actions = resource.change.actions;
    if (actions.length === 1 && actions[0] === 'no-op') return [];
    if (
      resource.address.startsWith(`${MODULE}.`) &&
      actions.length === 1 &&
      actions[0] === 'update'
    )
      return [];
    return [
      `${resource.address}: CI identity recovery permits only existing identity updates`,
    ];
  });
}
