import {
  GameSessionCommitmentsAttr,
  ownGameSessionCommitment,
} from '@libs/game-session-shared-ts/game-session-commitments';
import type { GameSession } from '@libs/game-session-shared-ts/game-session-state';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import { type Accessor, createMemo } from 'solid-js';

/**
 * The person's own commitment in the phase open now: what this device
 * holds, which is only ever theirs; `null` until they commit.
 */
export function useGameSessionCommitment(
  current: Accessor<GameSession | null>,
  myId: Accessor<string>
): Accessor<string | null> {
  const commitments = useSpaceRoomSelector(GameSessionCommitmentsAttr.from);
  return createMemo((): string | null => {
    const game = current();
    return game === null
      ? null
      : ownGameSessionCommitment(
          GameSessionCommitmentsAttr(commitments()),
          game,
          myId()
        );
  });
}
