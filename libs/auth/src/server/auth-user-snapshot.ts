/**
 * Parse helpers for auth-provider user snapshot payloads.
 * Not tied to any persistence table.
 */

/** Primary email from a serialized auth-provider user payload. */
export function readPrimaryEmailFromAuthSnapshot(
  data: Record<string, unknown>
): string | null {
  const primaryId = data['primary_email_address_id'];
  const addresses = data['email_addresses'];
  if (typeof primaryId !== 'string' || !Array.isArray(addresses)) {
    return null;
  }
  for (const entry of addresses) {
    if (entry === null || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    if (row['id'] !== primaryId) continue;
    const email = row['email_address'];
    return typeof email === 'string' && email.length > 0 ? email : null;
  }
  return null;
}
