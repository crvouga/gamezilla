import {
  CustomGameHandsAttr,
  ownCustomGameHand,
} from '@libs/game-session-shared-ts/custom-game-hands';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import { type Accessor, createMemo } from 'solid-js';

/**
 * The person's own dealt hand in the space's custom game, for a game whose
 * authority deals hands: what this device holds, which is only ever theirs.
 */
export function useCustomGameHand(
  current: Accessor<CustomGame | null>,
  myId: Accessor<string>
): Accessor<string | null> {
  const hands = useSpaceRoomSelector(CustomGameHandsAttr.from);
  return createMemo((): string | null => {
    const game = current();
    return game === null
      ? null
      : ownCustomGameHand(CustomGameHandsAttr(hands()), game, myId());
  });
}
