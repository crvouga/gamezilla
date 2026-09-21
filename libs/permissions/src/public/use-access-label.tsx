import { t } from '@lingui/core/macro';
import { type Accessor, createMemo } from 'solid-js';

import { ROLE } from '../shared/permission-catalog';
import { usePlanRole } from './use-plan-role';

/**
 * Short label for the caller's current policy bundle (settings summary row).
 * Bundle names live only in the policy package, so screens outside it render
 * this instead of branching on roles.
 */
export function useAccessLabel(): Accessor<string> {
  const role = usePlanRole();
  return createMemo(() => {
    if (role() === ROLE.planPaid) return t`Paid`;
    if (role() === ROLE.planFree) return t`Free`;
    return t`Guest`;
  });
}
