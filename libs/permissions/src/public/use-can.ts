import { type Decision, decide } from '@pkgs/permissions';
import { type Accessor, createMemo } from 'solid-js';

import type { AppGrantKey } from '../shared/permission-catalog';
import { usePermissionPolicy } from '../use-cases/decide-access/client/use-permission-policy';
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
  return createMemo(() => decide(policy(), subject(), key));
}

/** Whether the caller may `key` right now. */
export function useCan(
  key: AppGrantKey,
  scope?: AccessScopeAccessor
): Accessor<boolean> {
  const decision = useDecision(key, scope);
  return createMemo(() => decision().allowed);
}
