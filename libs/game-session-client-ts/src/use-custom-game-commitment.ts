import {
  CustomGameCommitmentsAttr,
  ownCustomGameCommitment,
} from '@libs/game-session-shared-ts/custom-game-commitments';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import { type Accessor, createMemo } from 'solid-js';

/**
 * The person's own commitment in the phase open now: what this device
 * holds, which is only ever theirs; `null` until they commit.
 */
export function useCustomGameCommitment(
  current: Accessor<CustomGame | null>,
  myId: Accessor<string>
): Accessor<string | null> {
  const commitments = useSpaceRoomSelector(CustomGameCommitmentsAttr.from);
  return createMemo((): string | null => {
    const game = current();
    return game === null
      ? null
      : ownCustomGameCommitment(
          CustomGameCommitmentsAttr(commitments()),
          game,
          myId()
        );
  });
}
