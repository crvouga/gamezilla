import { useMyId } from '@libs/auth-client/use-current-user';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import {
  buildPuzzleMatchedCountSql,
  buildPuzzleTotalCountSql,
  PUZZLE_NEXT_MAX_BAND,
} from '@libs/chess-puzzle-shared/next-puzzle-selection';
import type { ChessPuzzleFeedConfig } from '@libs/chess-puzzle-shared/chess-puzzle-feed-config';
import { resolveEffectivePuzzleRating } from '@libs/chess-puzzle-shared/chess-puzzle-feed-config';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

export type ChessPuzzleFeedPoolStats = {
  readonly matched: Accessor<number>;
  readonly total: Accessor<number>;
  readonly isLoading: Accessor<boolean>;
};

export function useChessPuzzleFeedPoolStats(
  config: Accessor<ChessPuzzleFeedConfig>
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
