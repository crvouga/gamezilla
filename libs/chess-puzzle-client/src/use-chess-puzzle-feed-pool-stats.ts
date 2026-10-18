import { useMyId } from '@libs/auth-client/use-current-user';
import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared/feed-config';
import { resolveEffectivePuzzleRating } from '@libs/game-puzzle-shared/feed-config';
import {
  buildPuzzleMatchedCountSql,
  buildPuzzleTotalCountSql,
  PUZZLE_NEXT_MAX_BAND,
} from '@libs/game-puzzle-shared/next-puzzle-selection';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

export type ChessPuzzleFeedPoolStats = {
  readonly matched: Accessor<number>;
  readonly total: Accessor<number>;
  readonly isLoading: Accessor<boolean>;
};

export function useChessPuzzleFeedPoolStats(
  config: Accessor<PuzzleFeedConfig>
): ChessPuzzleFeedPoolStats {
  const myId = useMyId();
  const profile = useChessPuzzleProfileRatings(myId);
  const matched = createQuery(() =>
    buildPuzzleMatchedCountSql({
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
  const total = createQuery(buildPuzzleTotalCountSql);
  return {
    matched: createMemo(() => matched.rows()[0]?.value ?? 0),
    total: createMemo(() => total.rows()[0]?.value ?? 0),
    isLoading: createMemo(() => matched.isLoading() || total.isLoading()),
  };
}
