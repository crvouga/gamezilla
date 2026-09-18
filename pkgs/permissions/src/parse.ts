import type { LimitKey, PermissionKey } from './catalog';
import type { PermissionPolicy, RoleSpec } from './policy';

/** Result of parsing untrusted policy JSON. */
export type PolicyParseResult<P extends string, L extends string> =
  | { readonly ok: true; readonly policy: PermissionPolicy<P, L> }
  | { readonly ok: false; readonly issues: readonly string[] };

const MAX_ROLES = 64;
const MAX_GRANTS = 64;
const MAX_PERMISSIONS = 256;
const MAX_LIMITS = 64;

const ROLE_SPEC_KEYS: Record<string, true> = {
  grants: true,
  permissions: true,
  limits: true,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(
  value: unknown,
  label: string,
  max: number,
  issues: string[]
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array of non-empty strings`);
    return undefined;
  }
  if (value.length > max) {
    issues.push(`${label} must hold at most ${max} entries`);
    return undefined;
  }
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length === 0) {
      issues.push(`${label} must be an array of non-empty strings`);
      return undefined;
    }
    out.push(entry);
  }
  return out;
}

function readLimits(
  value: unknown,
  label: string,
  issues: string[]
): Record<string, number | null> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    issues.push(`${label} must be an object`);
    return undefined;
  }
  const keys = Object.keys(value);
  if (keys.length > MAX_LIMITS) {
    issues.push(`${label} must hold at most ${MAX_LIMITS} entries`);
    return undefined;
  }
  const out: Record<string, number | null> = {};
  for (const key of keys) {
    const cap = value[key];
    if (cap === null) {
      out[key] = null;
      continue;
    }
    if (
      typeof cap !== 'number' ||
      !Number.isInteger(cap) ||
      !Number.isFinite(cap) ||
      cap < 0
    ) {
      issues.push(`${label}["${key}"] must be null or a non-negative integer`);
      continue;
    }
    out[key] = cap;
  }
  return out;
}

function readRoleSpec(
  value: unknown,
  role: string,
  issues: string[]
): RoleSpec {
  const label = `role "${role}"`;
  if (!isPlainObject(value)) {
    issues.push(`${label} must be an object`);
    return {};
  }
  for (const key of Object.keys(value)) {
    if (ROLE_SPEC_KEYS[key] !== true) {
      issues.push(`${label}: unexpected key "${key}"`);
    }
  }
  const grants = readStringArray(
    value['grants'],
    `${label}.grants`,
    MAX_GRANTS,
    issues
  );
  const permissions = readStringArray(
    value['permissions'],
    `${label}.permissions`,
    MAX_PERMISSIONS,
    issues
  );
  const limits = readLimits(value['limits'], `${label}.limits`, issues);
  return {
    ...(grants === undefined ? {} : { grants }),
    ...(permissions === undefined
      ? {}
      : { permissions: [...new Set(permissions)] }),
    ...(limits === undefined ? {} : { limits }),
  };
}

function findGrantsCycle(
  roles: Record<string, RoleSpec>
): readonly string[] | null {
  const done = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const visit = (role: string): readonly string[] | null => {
    if (onStack.has(role)) return [...stack.slice(stack.indexOf(role)), role];
    if (done.has(role)) return null;
    onStack.add(role);
    stack.push(role);
    for (const granted of roles[role]?.grants ?? []) {
      const found = visit(granted);
      if (found !== null) return found;
    }
    stack.pop();
    onStack.delete(role);
    done.add(role);
    return null;
  };

  for (const role of Object.keys(roles)) {
    const found = visit(role);
    if (found !== null) return found;
  }
  return null;
}

function validateGrants(
  roles: Record<string, RoleSpec>,
  issues: string[]
): void {
  for (const [role, spec] of Object.entries(roles)) {
    for (const granted of spec.grants ?? []) {
      if (roles[granted] === undefined) {
        issues.push(`role "${role}" grants unknown role "${granted}"`);
      }
    }
  }
  const cycle = findGrantsCycle(roles);
  if (cycle !== null) {
    issues.push(`role grants form a cycle: ${cycle.join(' -> ')}`);
  }
}

function freezeRoleSpec(spec: RoleSpec): RoleSpec {
  return Object.freeze({
    ...(spec.grants === undefined
      ? {}
      : { grants: Object.freeze([...spec.grants]) }),
    ...(spec.permissions === undefined
      ? {}
      : { permissions: Object.freeze([...spec.permissions]) }),
    ...(spec.limits === undefined
      ? {}
      : { limits: Object.freeze({ ...spec.limits }) }),
  });
}

function freezePolicy<P extends string, L extends string>(
  roles: Record<string, RoleSpec>
): PermissionPolicy<P, L> {
  const frozen: Record<string, RoleSpec> = {};
  for (const [role, spec] of Object.entries(roles)) {
    frozen[role] = freezeRoleSpec(spec);
  }
  return { roles: Object.freeze(frozen) } as PermissionPolicy<P, L>;
}

/**
 * Structural validation of untrusted policy JSON (config). Collects every issue
 * instead of throwing; an undeclared `grants` target and a `grants` cycle are
 * both rejected.
 */
export function parsePolicy<
  P extends string = PermissionKey,
  L extends string = LimitKey,
>(raw: unknown): PolicyParseResult<P, L> {
  if (!isPlainObject(raw)) {
    return { ok: false, issues: ['policy must be an object'] };
  }
  const rolesRaw = raw['roles'];
  if (!isPlainObject(rolesRaw)) {
    return { ok: false, issues: ['policy.roles must be an object'] };
  }
  const issues: string[] = [];
  const roleIds = Object.keys(rolesRaw);
  if (roleIds.length > MAX_ROLES) {
    issues.push(`policy.roles must hold at most ${MAX_ROLES} roles`);
  }
  const roles: Record<string, RoleSpec> = {};
  for (const role of roleIds) {
    if (role.length === 0) {
      issues.push('role ids must be non-empty');
      continue;
    }
    roles[role] = readRoleSpec(rolesRaw[role], role, issues);
  }
  validateGrants(roles, issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, policy: freezePolicy<P, L>(roles) };
}
