import { createSignal, type JSX, Show } from 'solid-js';
import { PersonalPuzzleStatsScreenView } from './personal-puzzle-stats-screen-view';
import type { GamePuzzlesClient } from './puzzle-client';
import { PuzzleFeedProvider } from './puzzle-feed-provider';
import { PuzzleGameProvider } from './puzzle-game-context';
import { PuzzleReviewBody } from './puzzle-review-screen';
import { PuzzleStatsBody } from './puzzle-stats-body';

/**
 * A game's puzzle stats outside any space (from Settings): its rating, game
 * log and a review of any logged puzzle, available offline. The routed
 * screen owns the one scroller and the page edge; the bodies sit in it.
 */
export function PersonalPuzzleStatsScreen(props: {
  readonly gameId: string;
  readonly puzzles: GamePuzzlesClient;
  readonly screenId: string;
}): JSX.Element {
  const [puzzleId, setPuzzleId] = createSignal<string | null>(null);
  const [solveIdx, setSolveIdx] = createSignal<number | null>(null);
  const review = (id: string): void => {
    setSolveIdx(null);
    setPuzzleId(id);
  };
  return (
    <PuzzleGameProvider gameId={props.gameId} client={props.puzzles}>
      <PuzzleFeedProvider>
        <PersonalPuzzleStatsScreenView
          screenId={props.screenId}
          reviewing={puzzleId() !== null}
          onBackToStats={() => setPuzzleId(null)}
        >
          <Show
            when={puzzleId()}
            keyed
            fallback={
              <PuzzleStatsBody
                titled={false}
                nested
                onSelectEntry={(entry) => review(entry.puzzleId)}
              />
            }
          >
            {(id) => (
              <PuzzleReviewBody
                nested
                puzzleId={id}
                cursor={{ solveIdx, seek: setSolveIdx }}
              />
            )}
          </Show>
        </PersonalPuzzleStatsScreenView>
      </PuzzleFeedProvider>
    </PuzzleGameProvider>
  );
}
