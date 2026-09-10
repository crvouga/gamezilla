/**
 * Process-wide open-space room client ids. Survives SpaceDetail remounts so
 * Close (minimize) reuses the same room `clientId`; cleared when the space
 * leaves the local open set (leave / end → slot unmount).
 *
 * Must not be the install `device_id` — DO session takeover is keyed by
 * `(actor, clientId)`, so tabs/opens need distinct ids.
 *
 * Keys are `${installId}:${spaceId}` so two in-process product actors
 * (product-simulator Alice/Bob) with different device ids do not share a latch.
 */

import type { CreateId } from '@pkgs/uuid';

const clientIdByKey = new Map<string, string>();

function sessionKey(spaceId: string, installId: string): string {
  return `${installId}:${spaceId}`;
}

export class SpaceOpenSessionStore {
  constructor(private readonly createId: CreateId) {}

  /**
   * Stable per-tab client id for this space while it remains open.
   * `installId` scopes the latch (device / install id) so multi-actor hosts
   * do not collide.
   */
  getOrCreate(spaceId: string, installId: string): string {
    const key = sessionKey(spaceId, installId);
    const existing = clientIdByKey.get(key);
    if (existing !== undefined) return existing;
    const next = this.createId();
    clientIdByKey.set(key, next);
    return next;
  }
}

export function readSpaceClientId(
  spaceId: string,
  installId: string
): string | null {
  return clientIdByKey.get(sessionKey(spaceId, installId)) ?? null;
}

/** Drop client id when the space is no longer open locally. */
export function clearSpaceOpenSession(
  spaceId: string,
  installId: string
): void {
  if (spaceId.length === 0 || installId.length === 0) return;
  clientIdByKey.delete(sessionKey(spaceId, installId));
}

/** Test helper — wipe all session latches. */
export function clearAllSpaceOpenSessions(): void {
  clientIdByKey.clear();
}
