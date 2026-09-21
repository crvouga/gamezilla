import type { LimitKey, PermissionKey, RoleId } from './catalog';
import { RoleCycleError, UnknownRoleError } from './errors';
import { type Facts, matchesPredicate } from './facts';
import type { PolicyVersion, RoleSpec } from './policy';
import type { QuotaGrant } from './quota-window';
import type { Subject } from './subject';
import { createSubject, withRoles } from './subject';

function roleSpec(policy: PolicyVersion, role: RoleId): RoleSpec {
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
  policy: PolicyVersion,
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
  policy: PolicyVersion,
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
  policy: PolicyVersion,
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

function mergeGrant(
  existing: QuotaGrant | undefined,
  next: QuotaGrant
): QuotaGrant {
  if (existing === undefined) return next;
  if (existing.limit === null) return existing;
  if (next.limit === null) return next;
  return next.limit > existing.limit ? next : existing;
}

/**
 * Merged quotas over the subject's closure: the grant with the largest limit
 * wins whole (window and boundary come with it); `null` (unlimited) beats all.
 */
export function quotasOf(
  policy: PolicyVersion,
  subject: Subject
): ReadonlyMap<string, QuotaGrant> {
  const out = new Map<string, QuotaGrant>();
  for (const role of resolveRoleClosure(policy, subject.roles)) {
    for (const [key, grant] of Object.entries(
      roleSpec(policy, role).quotas ?? {}
    )) {
      out.set(key, mergeGrant(out.get(key), grant));
    }
  }
  return out;
}

/** Merged numeric parameters: most permissive (`null` = unlimited) wins. */
export function paramsOf(
  policy: PolicyVersion,
  subject: Subject
): ReadonlyMap<string, number | null> {
  const out = new Map<string, number | null>();
  for (const role of resolveRoleClosure(policy, subject.roles)) {
    for (const [key, value] of Object.entries(
      roleSpec(policy, role).params ?? {}
    )) {
      out.set(key, mergeCap(out.get(key), value));
    }
  }
  return out;
}

/** Actions denied by restrictions whose predicate matches the subject's facts. */
export function restrictedOf(
  policy: PolicyVersion,
  subject: Subject
): ReadonlySet<string> {
  const out = new Set<string>();
  if (subject.facts === undefined) return out;
  for (const restriction of Object.values(policy.restrictions ?? {})) {
    if (!matchesPredicate(restriction.when, subject.facts)) continue;
    for (const action of restriction.deny) out.add(action);
  }
  return out;
}

/**
 * Facts in, roles out: every role whose `when` matches `facts` (policy key
 * order), plus `extraRoles` (e.g. per-resource presence roles). Code never
 * picks a role by name for a subject — the policy's predicates do.
 */
export function resolveSubject(
  policy: PolicyVersion,
  facts: Facts,
  extraRoles: readonly RoleId[] = []
): Subject {
  const matched = Object.entries(policy.roles)
    .filter(
      ([, spec]) =>
        spec.when !== undefined && matchesPredicate(spec.when, facts)
    )
    .map(([role]) => role);
  return withRoles({ roles: createSubject(matched).roles, facts }, extraRoles);
}
