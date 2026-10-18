import { Trans } from '@lingui/solid/macro';
import { CollectionScreen } from '@pkgs/ui-root-client/collection-screen';
import { createSignal, type JSX, Show } from 'solid-js';
import type { GamePuzzlesClient } from './puzzle-client';
import { PuzzleFeedProvider } from './puzzle-feed-provider';
import { PuzzleGameProvider } from './puzzle-game-context';
import { PuzzleReviewBody } from './puzzle-review-screen';
import { PuzzleStatsBody } from './puzzle-stats-body';

/**
 * A game's puzzle stats outside any space (from Settings): its rating, game
 * log and a review of any logged puzzle, available offline.
 */
export function PersonalPuzzleStatsScreen(props: {
  readonly gameId: string;
  readonly puzzles: GamePuzzlesClient;
  readonly screenId: string;
}): JSX.Element {
  const [puzzleId, setPuzzleId] = createSignal<string | null>(null);
  const [solveIdx, setSolveIdx] = createSignal(0);
  const review = (id: string): void => {
    setSolveIdx(0);
    setPuzzleId(id);
  };
  return (
    <PuzzleGameProvider gameId={props.gameId} client={props.puzzles}>
      <PuzzleFeedProvider>
        <CollectionScreen
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
                onSelectEntry={(entry) => review(entry.puzzleId)}
              />
            }
          >
            {(id) => (
              <PuzzleReviewBody
                puzzleId={id}
                cursor={{ solveIdx, seek: setSolveIdx }}
              />
            )}
          </Show>
        </CollectionScreen>
      </PuzzleFeedProvider>
    </PuzzleGameProvider>
  );
}
