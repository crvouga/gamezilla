import {
  GameSessionHandsAttr,
  ownGameSessionHand,
} from '@libs/game-session-shared-ts/game-session-hands';
import type { GameSession } from '@libs/game-session-shared-ts/game-session-state';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import { type Accessor, createMemo } from 'solid-js';

/**
 * The person's own dealt hand in the space's game session, for a game whose
 * authority deals hands: what this device holds, which is only ever theirs.
 */
export function useGameSessionHand(
  current: Accessor<GameSession | null>,
  myId: Accessor<string>
): Accessor<string | null> {
  const hands = useSpaceRoomSelector(GameSessionHandsAttr.from);
  return createMemo((): string | null => {
    const game = current();
    return game === null
      ? null
      : ownGameSessionHand(GameSessionHandsAttr(hands()), game, myId());
  });
}
