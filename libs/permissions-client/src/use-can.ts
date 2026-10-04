import type { Decision } from '@pkgs/permissions-shared/decision';
import { decide, decideLimit } from '@pkgs/permissions-shared/decision';
import { type Accessor, createMemo } from 'solid-js';

import type { AppGrantKey, AppLimit } from '@libs/permissions-shared/permission-catalog';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { usePermissionPolicy } from './use-permission-policy';
import type { AccessScopeAccessor } from './use-permission-subject';
import { usePermissionSubject } from './use-permission-subject';
import { usePrivacyDecision } from './use-privacy-decision';

/** A live decision for holding one more of a consumer's counted resource. */
export function useLimitDecision(
  key: AppLimit,
  used: Accessor<number>
): Accessor<Decision> {
  const policy = usePermissionPolicy();
  const subject = usePermissionSubject();
  return () => decideLimit(policy(), subject(), key, used());
}

/**
 * The caller's live decision for `key` (restrictions applied). `scope` adds
 * resource roles, e.g. `() => ({ spacePresence: 'host' })` inside a space.
 */
export function useDecision(
  key: AppGrantKey,
  scope?: AccessScopeAccessor
): Accessor<Decision> {
  const policy = usePermissionPolicy();
  const subject = usePermissionSubject(scope);
  const privacyDecision =
    key === PERMISSION.profileDeleteAccount ||
    key === PERMISSION.profileExportData
      ? usePrivacyDecision()
      : null;
  return () => {
    const decision = decide(policy(), subject(), key);
    return privacyDecision === null ? decision : privacyDecision(key, decision);
  };
}

/** Whether the caller may `key` right now. */
export function useCan(
  key: AppGrantKey,
  scope?: AccessScopeAccessor
): Accessor<boolean> {
  const decision = useDecision(key, scope);
  return createMemo(() => decision().allowed);
}
