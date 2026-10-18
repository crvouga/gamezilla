import { useMyId } from '@libs/auth-client/use-current-user';
import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared/feed-config';
import { resolveEffectivePuzzleRating } from '@libs/game-puzzle-shared/feed-config';
import { resolveProfilePuzzleRating } from '@libs/game-puzzle-shared/next-puzzle-selection';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
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
  config: Accessor<PuzzleFeedConfig>
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
