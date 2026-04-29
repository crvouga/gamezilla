/**
 * Single source of truth for how a principal's display name is shown in UI.
 */
export function displayNameForPrincipal(
  rawName: unknown,
  principalId: string
): string {
  const t = typeof rawName === 'string' ? rawName.trim() : '';
  if (t.length > 0) return t;
  return `User ${principalId.slice(0, 8)}`;
}
