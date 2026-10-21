import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import { resolveEffectivePuzzleRating } from '@libs/game-puzzle-shared-ts/feed-config';
import {
  buildPuzzleMatchedCountSql,
  buildPuzzleTotalCountSql,
  PUZZLE_NEXT_MAX_BAND,
} from '@libs/game-puzzle-shared-ts/next-puzzle-selection';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';

export type PuzzleFeedPoolStats = {
  readonly matched: Accessor<number>;
  readonly total: Accessor<number>;
  readonly isLoading: Accessor<boolean>;
};

export function usePuzzleFeedPoolStats(
  config: Accessor<PuzzleFeedConfig>
): PuzzleFeedPoolStats {
  const myId = useMyId();
  const profile = usePuzzleProfileRatings(myId);
  const { namespace } = usePuzzleGame();
  const matched = createQuery(() =>
    buildPuzzleMatchedCountSql({
      namespace,
      rating: resolveEffectivePuzzleRating({
        config: config(),
        profileRating: profile.profileRating(),
      }),
      halfWindow: PUZZLE_NEXT_MAX_BAND,
      ownerId: myId(),
      historyFilter: config().historyFilter,
      themes: config().themes,
      currentPuzzleId: null,
    })
  );
  const total = createQuery(() => buildPuzzleTotalCountSql(namespace));
  return {
    matched: createMemo(() => matched.rows()[0]?.value ?? 0),
    total: createMemo(() => total.rows()[0]?.value ?? 0),
    isLoading: createMemo(() => matched.isLoading() || total.isLoading()),
  };
}
