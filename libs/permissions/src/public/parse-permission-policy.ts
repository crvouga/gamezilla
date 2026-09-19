import { type PermissionPolicy, parsePolicy } from '@pkgs/permissions';

import type { AppLimit, AppPermission } from './permission-catalog';
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
): PermissionPolicy<AppPermission, AppLimit> {
  const result = parsePolicy<AppPermission, AppLimit>(coerceJsonValue(raw));
  return result.ok ? result.policy : DEFAULT_PERMISSION_POLICY;
}
