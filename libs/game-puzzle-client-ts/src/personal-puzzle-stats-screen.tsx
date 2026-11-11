import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { PersonalPuzzleStatsScreenView } from './personal-puzzle-stats-screen-view';
import type { GamePuzzlesClient } from './puzzle-client';
import { PuzzleFeedProvider } from './puzzle-feed-provider';
import { PuzzleGameProvider } from './puzzle-game-context';
import { PuzzleReviewBody } from './puzzle-review-screen';
import {
  PUZZLE_STATS_PLACES,
  type PuzzleStatsPlace,
  type PuzzleStatsStage,
  puzzleStatsStageOf,
} from './puzzle-stats-places';
import { PuzzleStatsScreenView } from './puzzle-stats-screen-view';
import { useEnteredPlace } from './use-entered-place';
import { usePuzzleHistory } from './use-puzzle-history';

/** The puzzle a `review` place replays; null on every other place. */
function reviewedPuzzle(place: PuzzleStatsPlace): string | null {
  return place.screen === 'review' ? place.puzzleId : null;
}

/** The stats' places over the player's synced history, under the route. */
function PersonalPuzzleStats(props: {
  readonly screenId: string;
}): JSX.Element {
  const history = usePuzzleHistory();
  const stage = createMemo<PuzzleStatsStage>(() =>
    puzzleStatsStageOf({ loading: history.loading() })
  );
  const nav = useEnteredPlace(PUZZLE_STATS_PLACES, stage);
  const [solveIdx, setSolveIdx] = createSignal<number | null>(null);
  const review = (puzzleId: string): void => {
    setSolveIdx(null);
    nav.open({ screen: 'review', puzzleId });
  };
  return (
    <PersonalPuzzleStatsScreenView
      screenId={props.screenId}
      place={nav.place()}
      onOpen={nav.open}
    >
      <PuzzleStatsScreenView
        stage={stage()}
        place={nav.place()}
        onOpen={nav.open}
        stats={history.stats()}
        gameLog={history.gameLog()}
        onSelectEntry={(entry) => review(entry.puzzleId)}
        titled={false}
        nested
        review={
          <Show when={reviewedPuzzle(nav.place())} keyed>
            {(puzzleId) => (
              <PuzzleReviewBody
                nested
                puzzleId={puzzleId}
                cursor={{ solveIdx, seek: setSolveIdx }}
                onBackToLog={() => nav.open({ screen: 'log' })}
              />
            )}
          </Show>
        }
      />
    </PersonalPuzzleStatsScreenView>
  );
}

/**
 * A game's puzzle stats outside any space (from Settings): its rating,
 * trend, game log and a review of any logged puzzle, each a small screen
 * of the stats' place machine, available offline. The routed screen owns
 * the one scroller and the page edge; the bodies sit in it.
 */
export function PersonalPuzzleStatsScreen(props: {
  readonly gameId: string;
  readonly puzzles: GamePuzzlesClient;
  readonly screenId: string;
}): JSX.Element {
  return (
    <PuzzleGameProvider gameId={props.gameId} client={props.puzzles}>
      <PuzzleFeedProvider>
        <PersonalPuzzleStats screenId={props.screenId} />
      </PuzzleFeedProvider>
    </PuzzleGameProvider>
  );
}
