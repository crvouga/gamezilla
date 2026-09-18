import type { LimitKey, PermissionKey, RoleId } from './catalog';
import { RoleCycleError, UnknownRoleError } from './errors';
import type { PermissionPolicy, RoleSpec } from './policy';
import type { Subject } from './subject';

function roleSpec(policy: PermissionPolicy, role: RoleId): RoleSpec {
  const spec = policy.roles[role];
  if (spec === undefined) throw new UnknownRoleError(role);
  return spec;
}

/**
 * Transitive, order-preserving role closure: subject roles first, then each
 * role's `grants` in pre-order. Throws `UnknownRoleError` for a role the
 * policy does not define and `RoleCycleError` when `grants` form a cycle.
 */
export function resolveRoleClosure(
  policy: PermissionPolicy,
  roles: readonly RoleId[]
): readonly RoleId[] {
  const out: RoleId[] = [];
  const done = new Set<RoleId>();
  const stack = new Set<RoleId>();

  const visit = (role: RoleId): void => {
    if (stack.has(role)) throw new RoleCycleError([...stack, role]);
    if (done.has(role)) return;
    const spec = roleSpec(policy, role);
    stack.add(role);
    out.push(role);
    done.add(role);
    for (const granted of spec.grants ?? []) visit(granted);
    stack.delete(role);
  };

  for (const role of roles) visit(role);
  return out;
}

/** Union of `permissions` over the subject's role closure (closure order). */
export function permissionsOf(
  policy: PermissionPolicy,
  subject: Subject
): ReadonlySet<PermissionKey> {
  const out = new Set<PermissionKey>();
  for (const role of resolveRoleClosure(policy, subject.roles)) {
    for (const permission of roleSpec(policy, role).permissions ?? []) {
      out.add(permission);
    }
  }
  return out;
}

function mergeCap(
  existing: number | null | undefined,
  next: number | null
): number | null {
  if (existing === undefined) return next;
  if (existing === null || next === null) return null;
  return Math.max(existing, next);
}

/**
 * Merged caps over the subject's role closure. A limit key appears only if some
 * role declares it; merge is most-permissive (`null` beats any number, two
 * numbers take `Math.max`).
 */
export function limitsOf(
  policy: PermissionPolicy,
  subject: Subject
): ReadonlyMap<LimitKey, number | null> {
  const out = new Map<LimitKey, number | null>();
  for (const role of resolveRoleClosure(policy, subject.roles)) {
    const limits = roleSpec(policy, role).limits;
    if (limits === undefined) continue;
    for (const [key, cap] of Object.entries(
      limits as Record<string, number | null | undefined>
    )) {
      if (cap === undefined) continue;
      out.set(key, mergeCap(out.get(key), cap));
    }
  }
  return out;
}
