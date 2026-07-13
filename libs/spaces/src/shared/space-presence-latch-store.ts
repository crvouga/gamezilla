import type { SpacePresence } from './resolve-space-presence';

/**
 * Process-wide presence latch so remounts of {@link useSpacePresence} do not
 * forget that this install was already `active` in `spaceId` (iOS route / provider
 * remounts otherwise flash `join` and tear down the room).
 */
const latchBySpaceId = new Map<string, SpacePresence>();

export function readSpacePresenceLatch(
  spaceId: string
): { spaceId: string; presence: SpacePresence } | null {
  if (spaceId.length === 0) return null;
  const presence = latchBySpaceId.get(spaceId);
  if (presence === undefined) return null;
  return { spaceId, presence };
}

export function writeSpacePresenceLatch(
  spaceId: string,
  presence: SpacePresence | null
): void {
  if (spaceId.length === 0) return;
  if (presence === null) {
    latchBySpaceId.delete(spaceId);
    return;
  }
  latchBySpaceId.set(spaceId, presence);
}

/** Call when the user intentionally leaves or ends a space. */
export function clearSpacePresenceLatch(spaceId: string): void {
  if (spaceId.length === 0) return;
  latchBySpaceId.delete(spaceId);
}
