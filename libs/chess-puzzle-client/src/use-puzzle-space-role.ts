/**
 * Who may drive the puzzle: the space host, and nobody else. Guests are
 * spectators. Resolved from the space's synced presence, which is the same
 * source the rest of the product uses for host/guest.
 */

import { useSpaceRoomSessionId } from '@libs/spaces-client/space-room-context';
import { useSpacePresence } from '@libs/spaces-client/public-use-space-presence';
import { type Accessor, createMemo } from 'solid-js';

export type PuzzleSpaceRole = 'host' | 'guest' | 'unknown';

export function usePuzzleSpaceRole(): Accessor<PuzzleSpaceRole> {
  const spaceId = useSpaceRoomSessionId();
  const presence = useSpacePresence(() => spaceId() ?? '');
  return createMemo(() => {
    if (spaceId() === null) return 'unknown';
    const current = presence();
    return current.status === 'active' ? current.role : 'unknown';
  });
}

/** True only for the space host — the one member who drives the puzzle. */
export function useIsPuzzleDriver(): Accessor<boolean> {
  const spaceId = useSpaceRoomSessionId();
  const role = usePuzzleSpaceRole();
  return createMemo(() => spaceId() !== null && role() === 'host');
}
