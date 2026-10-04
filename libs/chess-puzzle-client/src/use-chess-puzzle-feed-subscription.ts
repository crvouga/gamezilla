import { useSyncEngineInstance } from '@pkgs/sync-engine-client/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';

import type { ChessPuzzleFeedConfig, ChessPuzzlePoolRange } from '@libs/chess-puzzle-shared/chess-puzzle-feed-config';
import { chessPuzzlePoolRangesForRating } from '@libs/chess-puzzle-shared/chess-puzzle-feed-config';
import { useEffectivePuzzleRatingFor } from './use-effective-puzzle-rating';

const POOL_QUERY_NAME = 'chessPuzzlePool';

function rangesKey(ranges: readonly ChessPuzzlePoolRange[]): string {
  return ranges.map((r) => `${r.ratingMin}-${r.ratingMax}`).join(',');
}

/**
 * Hydrate the puzzle pool bands around the player's effective rating for the
 * lifetime of the mounted feed. Re-subscribes only when the band set changes
 * (rating crossing a band edge, or a feed-config edit), so per-solve Elo
 * drift does not churn subscriptions. Rows from earlier bands stay local.
 *
 * Returns `poolReady`: first hydrate for the current bands has landed.
 */
export function useChessPuzzleFeedSubscription(
  config: Accessor<ChessPuzzleFeedConfig>
): Accessor<boolean> {
  const sync = useSyncEngineInstance();
  const rating = useEffectivePuzzleRatingFor(config);
  const [poolReady, setPoolReady] = createSignal(false);
  const ranges = createMemo(
    () => chessPuzzlePoolRangesForRating(rating()),
    [],
    { equals: (a, b) => rangesKey(a) === rangesKey(b) }
  );
  createEffect(() => {
    setPoolReady(false);
    const handle = sync.subscribeQueries(
      ranges().map((params) => ({ name: POOL_QUERY_NAME, params }))
    );
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
