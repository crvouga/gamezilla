/**
 * How a host in front of the room (an API gateway) hands a connection's
 * grants to the room host it forwards the upgrade to: one request header,
 * comma-separated. The gateway sets it after deciding and removes whatever
 * the client sent under that name, so a client can never supply its own.
 */

/** Default request header carrying the admitted connection's grants. */
export const ROOM_GRANTS_HEADER = 'x-actor-grants';

/** Header value for `grants` (grants never contain commas or whitespace). */
export function encodeRoomGrants(grants: readonly string[]): string {
  for (const grant of grants) {
    if (grant.length === 0 || /[\s,]/.test(grant)) {
      throw new Error(`room grant must be a non-empty token: ${grant}`);
    }
  }
  return grants.join(',');
}

/** Grants from a header value; absent or empty is none. */
export function decodeRoomGrants(raw: string | null): readonly string[] {
  if (raw === null) return [];
  return raw
    .split(',')
    .map((grant) => grant.trim())
    .filter((grant) => grant.length > 0);
}
