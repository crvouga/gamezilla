import type {
  PuzzleFeedConfig,
  PuzzlePoolRange,
} from '@libs/game-puzzle-shared/feed-config';
import {
  puzzleNearestRating,
  puzzlePoolRangesForRating,
} from '@libs/game-puzzle-shared/feed-config';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';
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
  const rating = useEffectivePuzzleRatingFor(config);
  const [poolReady, setPoolReady] = createSignal(false);
  const ranges = createMemo(() => puzzlePoolRangesForRating(rating()), [], {
    equals: (a, b) => rangesKey(a) === rangesKey(b),
  });
  // Band-centred, so it changes only when the bands do.
  const nearestRating = createMemo(() => puzzleNearestRating(rating()));
  createEffect(() => {
    setPoolReady(false);
    const bands = ranges();
    const handle = sync.subscribeQueries([
      ...bands.map((params) => ({ name: POOL_QUERY_NAME, params })),
      {
        name: NEAREST_QUERY_NAME,
        params: { rating: nearestRating() },
      },
    ]);
    let live = true;
    void handle.ready.then((ready) => {
      if (live && ready) setPoolReady(true);
    });
    onCleanup(() => {
      live = false;
      handle.unsubscribe();
    });
  });
  return poolReady;
}
