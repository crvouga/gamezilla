import type { RoleId } from './catalog';
import type { Facts } from './facts';

/**
 * A principal holding a set of roles. `facts` (when the subject came from
 * `resolveSubject`) are what restrictions are evaluated against.
 */
export type Subject = {
  readonly roles: readonly RoleId[];
  readonly facts?: Facts;
};

function appendRoles(
  roles: readonly RoleId[],
  extra: readonly RoleId[]
): RoleId[] {
  const out: RoleId[] = [];
  const seen = new Set<RoleId>();
  for (const role of [...roles, ...extra]) {
    if (seen.has(role)) continue;
    seen.add(role);
    out.push(role);
  }
  return out;
}

/** Order-preserving, deduped subject. */
export function createSubject(roles: readonly RoleId[]): Subject {
  return { roles: appendRoles([], roles) };
}

/** Additive union of a subject with more roles (dedup, order-preserving). */
export function withRoles(subject: Subject, roles: readonly RoleId[]): Subject {
  return {
    roles: appendRoles(subject.roles, roles),
    ...(subject.facts === undefined ? {} : { facts: subject.facts }),
  };
}
