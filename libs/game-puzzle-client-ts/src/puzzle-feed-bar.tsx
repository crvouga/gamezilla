import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { resolveEffectivePuzzleRating } from '@libs/game-puzzle-shared-ts/feed-config';
import { derivePuzzleRatingChange } from '@libs/game-puzzle-shared-ts/rating-change';
import { createMemo, type JSX } from 'solid-js';
import {
  PuzzleFeedBarView,
  type PuzzleFeedRatingChange,
} from './puzzle-feed-bar-view';
import { usePuzzleFeedState } from './puzzle-feed-context';
import { usePuzzleGame } from './puzzle-game-context';
import { usePuzzleInteractions } from './puzzle-play-queries';
import { usePuzzleAllowance } from './use-puzzle-allowance';
import { usePuzzleFeedPoolStats } from './use-puzzle-feed-pool-stats';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';
import { usePuzzleRatingEvents } from './use-puzzle-rating-events';

export type PuzzleFeedBarProps = {
  puzzleId?: string | undefined;
  rating?: number | undefined;
  /** The puzzle's themes, shown once the puzzle is over. */
  themes?: readonly string[] | undefined;
  /** The puzzle is over: its own rating and themes may show. */
  over?: boolean | undefined;
  onOpenFeedSettings: () => void;
};

/** This play's rating change, from the synced ledger and interactions. */
function usePuzzleFeedRatingChange(
  puzzleId: () => string
): () => PuzzleFeedRatingChange {
  const events = usePuzzleRatingEvents();
  const interactions = usePuzzleInteractions(puzzleId);
  const change = createMemo(() =>
    derivePuzzleRatingChange({
      puzzleId: puzzleId(),
      interactions: interactions.rows(),
      ratingEvents: events(),
    })
  );
  return () => {
    const current = change();
    if (current.kind === 'unrated') return 'unrated';
    return current.kind === 'rated' ? current.delta : null;
  };
}

/** The feed strip wired to the saved feed, the pool and the allowance. */
export function PuzzleFeedBar(props: PuzzleFeedBarProps): JSX.Element {
  const myId = useMyId();
  const allowance = usePuzzleAllowance();
  const { profileRating } = usePuzzleProfileRatings(myId);
  const feed = usePuzzleFeedState();
  const config = feed.config;
  const pool = usePuzzleFeedPoolStats(config);
  const { client } = usePuzzleGame();
  const ratingChange = usePuzzleFeedRatingChange(() => props.puzzleId ?? '');
  const effectiveRating = createMemo(() =>
    resolveEffectivePuzzleRating({
      config: config(),
      profileRating: profileRating(),
    })
  );
  return (
    <PuzzleFeedBarView
      puzzleId={props.puzzleId}
      rating={props.rating}
      themes={props.themes}
      over={props.over}
      ratingChange={ratingChange()}
      config={config()}
      configReady={feed.configReady()}
      effectiveRating={effectiveRating()}
      matched={pool.matched()}
      total={pool.total()}
      allowanceLabel={allowance.label()}
      themeLabel={client.themes?.label ?? ((theme) => theme)}
      onOpenFeedSettings={props.onOpenFeedSettings}
    />
  );
}
