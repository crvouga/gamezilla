/**
 * Process-wide open-space session state. Survives SpaceDetail remounts so
 * Close (minimize) reuses the same room `clientId` and join announce latch;
 * cleared when the space leaves the local open set (leave / end).
 */

const clientIdBySpaceId = new Map<string, string>();
const announcedJoinBySpaceId = new Set<string>();

/** Stable per-tab client id for this space while it remains open. */
export function getOrCreateSpaceClientId(spaceId: string): string {
  const existing = clientIdBySpaceId.get(spaceId);
  if (existing !== undefined) return existing;
  const next = globalThis.crypto.randomUUID();
  clientIdBySpaceId.set(spaceId, next);
  return next;
}

export function readSpaceClientId(spaceId: string): string | null {
  return clientIdBySpaceId.get(spaceId) ?? null;
}

export function hasAnnouncedSpaceJoin(spaceId: string): boolean {
  return announcedJoinBySpaceId.has(spaceId);
}

export function markAnnouncedSpaceJoin(spaceId: string): void {
  if (spaceId.length === 0) return;
  announcedJoinBySpaceId.add(spaceId);
}

/** Drop client id + announce latch when the space is no longer open locally. */
export function clearSpaceOpenSession(spaceId: string): void {
  if (spaceId.length === 0) return;
  clientIdBySpaceId.delete(spaceId);
  announcedJoinBySpaceId.delete(spaceId);
}

/** Test helper — wipe all session latches. */
export function clearAllSpaceOpenSessions(): void {
  clientIdBySpaceId.clear();
  announcedJoinBySpaceId.clear();
}
