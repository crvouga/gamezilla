import { useMyId } from '@libs/auth/public/use-current-user';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import { resolveProfilePuzzleRating } from '../../shared/puzzle-session/next-puzzle-selection';
import {
  type ChessPuzzleFeedConfig,
  resolveEffectivePuzzleRating,
} from '../chess-puzzle-feed-config';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';

type PuzzleRatingValueRow = { readonly value: number };

/** Profile rating from the synced profile row, or the default seed rating. */
export function usePuzzleProfileRating(): Accessor<number> {
  const myId = useMyId();
  const query = createMemo(
    () => sql<PuzzleRatingValueRow>`
      SELECT rating AS value
      FROM chess_puzzle_profiles
      WHERE id = ${myId()}
        AND deleted_at IS NULL
    `
  );
  const { rows } = createQuery(query);
  return createMemo(() => resolveProfilePuzzleRating(rows()[0]?.value));
}

/**
 * Rating the feed targets for a given config accessor: profile rating + auto
 * offset, or the custom target. Drives both the sync bands and the pick window.
 */
export function useEffectivePuzzleRatingFor(
  config: Accessor<ChessPuzzleFeedConfig>
): Accessor<number> {
  const profileRating = usePuzzleProfileRating();
  return createMemo(() =>
    resolveEffectivePuzzleRating({
      config: config(),
      profileRating: profileRating(),
    })
  );
}

/** {@link useEffectivePuzzleRatingFor} over the shared feed config. */
export function useEffectivePuzzleRating(): Accessor<number> {
  const [config] = useChessPuzzleFeedConfig();
  return useEffectivePuzzleRatingFor(config);
}
