/**
 * The access model's internals, for this package's tests and for composition
 * roots that materialize the shipped policy. Feature code never imports this:
 * it gates through `public/` (`useCan`, `usePermissions`, `requireInMutation`).
 */
import { resolveSubject } from '@pkgs/permissions';

import { type AccessInputs, resolveAccessFacts } from '../shared/access-facts';
import { type PlanRole, ROLE } from '../shared/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '../shared/permission-policy';

export {
  type AccessInputs,
  governingSubscription,
  readSubscriptionSnapshot,
  resolveAccessFacts,
  type SubscriptionRow,
  type SubscriptionSnapshot,
} from '../shared/access-facts';
export { parsePermissionPolicy } from '../shared/parse-permission-policy';
export {
  type AppRole,
  type PlanRole,
  ROLE,
} from '../shared/permission-catalog';
export {
  DEFAULT_PERMISSION_POLICY,
  PERMISSION_POLICY_VERSION,
} from '../shared/permission-policy';

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
