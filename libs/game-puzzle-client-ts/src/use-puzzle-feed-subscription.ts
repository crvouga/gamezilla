import type {
  PuzzleFeedConfig,
  PuzzlePoolRange,
} from '@libs/game-puzzle-shared-ts/feed-config';
import {
  puzzleNearestRating,
  puzzlePoolRangesForRating,
} from '@libs/game-puzzle-shared-ts/feed-config';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';
import { useEffectivePuzzleRatingFor } from './use-effective-puzzle-rating';

const POOL_QUERY_NAME = 'chessPuzzlePool';
const NEAREST_QUERY_NAME = 'chessPuzzleNearest';

function rangesKey(ranges: readonly PuzzlePoolRange[]): string {
  return ranges.map((r) => `${r.ratingMin}-${r.ratingMax}`).join(',');
}

/**
 * Hydrate the puzzle pool bands around the player's effective rating, and
 * the servable puzzles nearest it wherever they sit (the §9 fallback when the
 * bands hold nothing unplayed), for the lifetime of the mounted feed. Re-subscribes only when the band set changes
 * (rating crossing a band edge, or a feed-config edit), so per-solve Elo
 * drift does not churn subscriptions. Rows from earlier bands stay local.
 *
 * Returns `poolReady`: first hydrate for the current bands has landed.
 */
export function usePuzzleFeedSubscription(
  config: Accessor<PuzzleFeedConfig>
): Accessor<boolean> {
  const sync = useSyncEngineInstance();
  const { namespace } = usePuzzleGame();
  // The game's share of the catalogue; the durable game's reads name none.
  const scope = namespace === '' ? {} : { namespace };
  const rating = useEffectivePuzzleRatingFor(config);
  const ranges = createMemo(() => puzzlePoolRangesForRating(rating()), {
    equals: (a, b) => rangesKey(a) === rangesKey(b),
  });
  // Band-centred, so it changes only when the bands do.
  const nearestRating = createMemo(() => puzzleNearestRating(rating()));
  // Other bands are not ready until their own hydrate lands.
  const [poolReady, setPoolReady] = createSignal((): boolean => {
    ranges();
    nearestRating();
    return false;
  });
  createEffect(
    () => ({ bands: ranges(), nearest: nearestRating() }),
    ({ bands, nearest }) => {
      const handle = sync.subscribeQueries([
        ...bands.map((range) => ({
          name: POOL_QUERY_NAME,
          params: { ...range, ...scope },
        })),
        { name: NEAREST_QUERY_NAME, params: { rating: nearest, ...scope } },
      ]);
      let live = true;
      void handle.ready.then((ready) => {
        if (live && ready) setPoolReady(true);
      });
      return () => {
        live = false;
        handle.unsubscribe();
      };
    }
  );
  return poolReady;
}
