/**
 * Process-wide open-space room client ids. Survives SpaceDetail remounts so
 * Close (minimize) reuses the same room `clientId`; cleared when the space
 * leaves the local open set (leave / end → slot unmount).
 *
 * Must not be the install `device_id` — DO session takeover is keyed by
 * `(actor, clientId)`, so tabs/opens need distinct ids.
 */

import type { CreateId } from '@pkgs/uuid';

const clientIdBySpaceId = new Map<string, string>();

/** Stable per-tab client id for this space while it remains open. */
export function getOrCreateSpaceClientId(
  spaceId: string,
  createId: CreateId
): string {
  const existing = clientIdBySpaceId.get(spaceId);
  if (existing !== undefined) return existing;
  const next = createId();
  clientIdBySpaceId.set(spaceId, next);
  return next;
}

export function readSpaceClientId(spaceId: string): string | null {
  return clientIdBySpaceId.get(spaceId) ?? null;
}

/** Drop client id when the space is no longer open locally. */
export function clearSpaceOpenSession(spaceId: string): void {
  if (spaceId.length === 0) return;
  clientIdBySpaceId.delete(spaceId);
}

/** Test helper — wipe all session latches. */
export function clearAllSpaceOpenSessions(): void {
  clientIdBySpaceId.clear();
}
