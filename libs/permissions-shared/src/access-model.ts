/**
 * The access model's internals, for this package's tests and for composition
 * roots that materialize the shipped policy. Feature code never imports this:
 * it gates through `public/` (`useCan`, `usePermissions`, `requireInMutation`).
 */
import { resolveSubject } from '@pkgs/permissions-shared/resolve';

import type { AccessInputs } from './access-facts';
import { resolveAccessFacts } from './access-facts';
import type { PlanRole } from './permission-catalog';
import { ROLE } from './permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from './permission-policy';

const PLAN_ROLES: ReadonlySet<string> = new Set<PlanRole>([
  ROLE.planGuest,
  ROLE.planFree,
  ROLE.planPaid,
]);

/** The plan role the shipped policy's predicates assign for these inputs. */
export function resolvePlanRole(inputs: AccessInputs): PlanRole {
  const subject = resolveSubject(
    DEFAULT_PERMISSION_POLICY,
    resolveAccessFacts(inputs)
  );
  const role = subject.roles.find((candidate) => PLAN_ROLES.has(candidate));
  return (role ?? ROLE.planGuest) as PlanRole;
}
