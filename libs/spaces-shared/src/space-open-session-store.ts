/**
 * App-scoped open-space room client ids. Survives SpaceDetail remounts so
 * Close (minimize) reuses the same room `clientId`; cleared when the space
 * leaves the local open set (leave / end → slot unmount).
 *
 * Must not be the install `device_id` — DO session takeover is keyed by
 * `(actor, clientId)`, so tabs/opens need distinct ids.
 *
 * Keys are `${installId}:${spaceId}` so two in-process product actors
 * (product-harness Alice/Bob) with different device ids do not share a latch.
 */

import type { CreateId } from '@pkgs/uuid-shared/create-id';

function sessionKey(spaceId: string, installId: string): string {
  return `${installId}:${spaceId}`;
}

export class SpaceOpenSessionStore {
  readonly #clientIdByKey = new Map<string, string>();

  constructor(private readonly createId: CreateId) {}

  /**
   * Stable per-tab client id for this space while it remains open.
   * `installId` scopes the latch (device / install id) so multi-actor hosts
   * do not collide.
   */
  getOrCreate(spaceId: string, installId: string): string {
    const key = sessionKey(spaceId, installId);
    const existing = this.#clientIdByKey.get(key);
    if (existing !== undefined) return existing;
    const next = this.createId();
    this.#clientIdByKey.set(key, next);
    return next;
  }
  read(spaceId: string, installId: string): string | null {
    return this.#clientIdByKey.get(sessionKey(spaceId, installId)) ?? null;
  }

  /** Drop client id when the space is no longer open locally. */
  clear(spaceId: string, installId: string): void {
    this.#clientIdByKey.delete(sessionKey(spaceId, installId));
  }
}
