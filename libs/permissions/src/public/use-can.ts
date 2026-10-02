import { type Decision, decide } from '@pkgs/permissions';
import { type Accessor, createMemo } from 'solid-js';

import type { AppGrantKey } from '../shared/permission-catalog';
import { usePermissionPolicy } from '../use-cases/decide-access/client/use-permission-policy';
import { usePrivacyDecision } from '../use-cases/decide-access/client/use-privacy-decision';
import { PERMISSION } from '../shared/permission-catalog';
import {
  type AccessScopeAccessor,
  usePermissionSubject,
} from '../use-cases/decide-access/client/use-permission-subject';

export type { AccessScopeAccessor };

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
  const privacyDecision = usePrivacyDecision();
  return () => {
    const decision = decide(policy(), subject(), key);
    return key === PERMISSION.profileDeleteAccount || key === PERMISSION.profileExportData ? privacyDecision(key, decision) : decision;
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
