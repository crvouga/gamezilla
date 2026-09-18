import { checkLimit, type LimitVerdict } from '@pkgs/permissions';
import { type Accessor, createMemo } from 'solid-js';

import type { AppLimit } from './permission-catalog';
import { usePermissionPolicy } from './use-permission-policy';
import { usePermissionSubject } from './use-permission-subject';

/** Evaluates a counted limit against the caller's roles and current usage. */
export function usePermissionLimit(
  limit: AppLimit,
  usage: Accessor<number>
): Accessor<LimitVerdict> {
  const policy = usePermissionPolicy();
  const subject = usePermissionSubject();
  return createMemo(() => checkLimit(policy(), subject(), limit, usage()));
}
