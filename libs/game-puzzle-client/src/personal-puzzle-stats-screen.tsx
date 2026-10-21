import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { createSignal, type JSX, Show } from 'solid-js';
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
        <ContentScreen
          screenId={props.screenId}
          breadcrumbs={[
            { name: <Trans>Settings</Trans>, href: '/more' },
            {
              name: <Trans>Puzzle stats</Trans>,
              ...(puzzleId() === null
                ? {}
                : { onClick: () => setPuzzleId(null) }),
            },
            ...(puzzleId() === null
              ? []
              : [{ name: <Trans>Puzzle review</Trans> }]),
          ]}
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
        </ContentScreen>
      </PuzzleFeedProvider>
    </PuzzleGameProvider>
  );
}
