import type { PermissionPolicy } from '@pkgs/permissions-shared/policy';
import { parsePolicy } from '@pkgs/permissions-shared/parse';

import type { AppLimit, AppPolicyKey } from './permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from './permission-policy';

function coerceJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Parses a stored `permission_policy` value. Malformed config degrades to the
 * shipped policy rather than crashing a caller.
 */
export function parsePermissionPolicy(
  raw: unknown
): PermissionPolicy<AppPolicyKey, AppLimit> {
  const result = parsePolicy<AppPolicyKey, AppLimit>(coerceJsonValue(raw));
  return result.ok ? result.policy : DEFAULT_PERMISSION_POLICY;
}
