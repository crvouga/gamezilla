import { useMyId } from '@libs/auth/client/use-current-user';
import { useQuery } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';

import { resolveEffectivePuzzleRating } from '../../shared/chess-puzzle-feed-config';
import {
  buildPuzzleMatchedCountSql,
  buildPuzzleTotalCountSql,
  PUZZLE_NEXT_MAX_BAND,
} from './next-puzzle-id-helpers';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

export type ChessPuzzleFeedPoolStats = {
  readonly matched: number;
  readonly total: number;
  readonly isLoading: boolean;
};

export function useChessPuzzleFeedPoolStats(): ChessPuzzleFeedPoolStats {
  const myId = useMyId();
  const [config] = useChessPuzzleFeedConfig();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  const rating = useMemo(
    () => resolveEffectivePuzzleRating({ config, profileRating }),
    [config, profileRating]
  );
  const matchedQuery = useMemo(
    () =>
      buildPuzzleMatchedCountSql({
        rating,
        halfWindow: PUZZLE_NEXT_MAX_BAND,
        ownerId: myId,
        historyFilter: config.historyFilter,
        themes: config.themes,
        currentPuzzleId: null,
      }),
    [rating, myId, config.historyFilter, config.themes]
  );
  const totalQuery = useMemo(() => buildPuzzleTotalCountSql(), []);
  const matched = useQuery(matchedQuery);
  const total = useQuery(totalQuery);
  return {
    matched: matched.rows[0]?.value ?? 0,
    total: total.rows[0]?.value ?? 0,
    isLoading: matched.isLoading || total.isLoading,
  };
}
