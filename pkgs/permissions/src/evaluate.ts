import type { LimitKey, PermissionKey, RoleId } from './catalog';
import type { PolicyVersion } from './policy';
import { limitsOf, permissionsOf, resolveRoleClosure } from './resolve';
import type { Subject } from './subject';

/** Outcome of a boolean permission check. */
export type PermissionDecision = {
  readonly allowed: boolean;
  /** Closure roles that declare the permission directly (closure order). */
  readonly grantedBy: readonly RoleId[];
};

/** Outcome of a counted-limit check. */
export type LimitVerdict = {
  readonly allowed: boolean;
  readonly limit: number | null;
  readonly remaining: number | null;
};

/** Whether the subject holds `permission`; grants are additive across roles. */
export function can(
  policy: PolicyVersion,
  subject: Subject,
  permission: PermissionKey
): PermissionDecision {
  if (!permissionsOf(policy, subject).has(permission)) {
    return { allowed: false, grantedBy: [] };
  }
  const grantedBy = resolveRoleClosure(policy, subject.roles).filter((role) =>
    (policy.roles[role]?.permissions ?? []).includes(permission)
  );
  return { allowed: true, grantedBy };
}

/**
 * Evaluates a counted limit. An undeclared or `null` cap means unlimited —
 * limits are restrictions, only roles that declare one restrict anything.
 */
export function checkLimit(
  policy: PolicyVersion,
  subject: Subject,
  limit: LimitKey,
  usage: number
): LimitVerdict {
  const cap = limitsOf(policy, subject).get(limit);
  if (cap === undefined || cap === null) {
    return { allowed: true, limit: null, remaining: null };
  }
  return {
    allowed: usage < cap,
    limit: cap,
    remaining: Math.max(0, cap - usage),
  };
}
