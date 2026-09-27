import type { LimitKey, PermissionKey } from './catalog';
import {
  isPlainObject,
  readParams,
  readPolicyMeta,
  readPredicate,
  readQuotas,
} from './parse-extras';
import type { PermissionPolicy, PolicyVersion, RoleSpec } from './policy';

/** Result of parsing untrusted policy JSON. */
export type PolicyParseResult<P extends string, L extends string> =
  | { readonly ok: true; readonly policy: PermissionPolicy<P, L> }
  | { readonly ok: false; readonly issues: readonly string[] };

const MAX_ROLES = 64;
const MAX_GRANTS = 64;
const MAX_PERMISSIONS = 256;
const MAX_LIMITS = 64;

const MAX_HISTORY = 32;

const ROLE_SPEC_KEYS: Record<string, true> = {
  when: true,
  grants: true,
  permissions: true,
  limits: true,
  quotas: true,
  params: true,
};

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
  const when = readPredicate(value['when'], `${label}.when`, issues);
  const quotas = readQuotas(value['quotas'], `${label}.quotas`, issues);
  const params = readParams(value['params'], `${label}.params`, issues);
  return {
    ...(when === undefined ? {} : { when }),
    ...(quotas === undefined ? {} : { quotas }),
    ...(params === undefined ? {} : { params }),
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
    ...(spec.when === undefined ? {} : { when: spec.when }),
    ...(spec.quotas === undefined
      ? {}
      : { quotas: Object.freeze({ ...spec.quotas }) }),
    ...(spec.params === undefined
      ? {}
      : { params: Object.freeze({ ...spec.params }) }),
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

function freezeRoles(
  roles: Record<string, RoleSpec>
): Readonly<Record<string, RoleSpec>> {
  const frozen: Record<string, RoleSpec> = {};
  for (const [role, spec] of Object.entries(roles)) {
    frozen[role] = freezeRoleSpec(spec);
  }
  return Object.freeze(frozen);
}

function readVersion(
  raw: unknown,
  label: string,
  issues: string[]
): PolicyVersion | undefined {
  if (!isPlainObject(raw)) {
    issues.push(`${label} must be an object`);
    return undefined;
  }
  const rolesRaw = raw['roles'];
  if (!isPlainObject(rolesRaw)) {
    issues.push(`${label}.roles must be an object`);
    return undefined;
  }
  const roleIds = Object.keys(rolesRaw);
  if (roleIds.length > MAX_ROLES) {
    issues.push(`${label}.roles must hold at most ${MAX_ROLES} roles`);
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
  return { ...readPolicyMeta(raw, issues), roles: freezeRoles(roles) };
}

function readHistory(
  value: unknown,
  issues: string[]
): readonly PolicyVersion[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_HISTORY) {
    issues.push(`policy.history must be an array of at most ${MAX_HISTORY}`);
    return undefined;
  }
  const out: PolicyVersion[] = [];
  value.forEach((entry, index) => {
    const version = readVersion(entry, `policy.history[${index}]`, issues);
    if (version !== undefined) out.push(version);
  });
  return Object.freeze(out);
}

/**
 * Structural validation of untrusted policy JSON (config). Collects every issue
 * instead of throwing; an undeclared `grants` target and a `grants` cycle are
 * both rejected. `history` holds retained prior versions.
 */
export function parsePolicy<
  P extends string = PermissionKey,
  L extends string = LimitKey,
>(raw: unknown): PolicyParseResult<P, L> {
  if (!isPlainObject(raw)) {
    return { ok: false, issues: ['policy must be an object'] };
  }
  if (!isPlainObject(raw['roles'])) {
    return { ok: false, issues: ['policy.roles must be an object'] };
  }
  const issues: string[] = [];
  const current = readVersion(raw, 'policy', issues);
  const history = readHistory(raw['history'], issues);
  if (issues.length > 0 || current === undefined) return { ok: false, issues };
  const policy = Object.freeze({
    ...current,
    ...(history === undefined ? {} : { history }),
  });
  return { ok: true, policy: policy as PermissionPolicy<P, L> };
}
