/**
 * Parse helpers for auth-provider user snapshot payloads.
 * Not tied to any persistence table.
 */

/** Primary email from a serialized IdP (or compatible) user payload. */
export function readPrimaryEmailFromAuthSnapshot(
  data: Record<string, unknown>
): string | null {
  const email = data['email'];
  if (typeof email === 'string' && email.trim().length > 0) {
    return email.trim();
  }
  return null;
}
