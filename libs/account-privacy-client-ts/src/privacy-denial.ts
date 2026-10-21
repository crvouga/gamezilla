import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import type { MutationFailure } from '@pkgs/sync-engine-shared-ts/mutations-types';

/**
 * The permission denial a privacy mutation was refused with, keyed to
 * `action`'s unlock copy, or `null` for any other failure. The server's
 * decision names no action, so its way forward is looked up under `action`.
 */
export function privacyDenial(
  failure: MutationFailure | undefined,
  action: string
): Decision | null {
  const decision = failure?.meta?.['decision'];
  if (typeof decision !== 'object' || decision === null) return null;
  const denial = decision as Decision;
  if (denial.allowed !== false) return null;
  if (denial.unlockRef !== undefined || denial.reason === undefined)
    return denial;
  return { ...denial, unlockRef: `${action}#${denial.reason}` };
}
