import { type Accessor, createMemo } from 'solid-js';

import { type PlanRole, ROLE } from '../shared/permission-catalog';
import { usePermissionSubject } from './use-permission-subject';

const PLAN_ROLES: ReadonlySet<string> = new Set<PlanRole>([
  ROLE.planGuest,
  ROLE.planFree,
  ROLE.planPaid,
]);

/**
 * The plan role the live policy assigned — a label for billing's own screen.
 * Never an access decision: gate through `usePermissions` / `useCan`.
 */
export function usePlanRole(): Accessor<PlanRole> {
  const subject = usePermissionSubject();
  return createMemo(
    () =>
      (subject().roles.find((role) => PLAN_ROLES.has(role)) ??
        ROLE.planGuest) as PlanRole
  );
}
