import { Trans } from '@lingui/solid/macro';
import { CollectionScreen } from '@pkgs/ui-root-client/collection-screen';
import { createSignal, type JSX, Show } from 'solid-js';
import { ChessPuzzleFeedProvider } from './chess-puzzle-feed-provider';
import { ChessPuzzleReviewBody } from './chess-puzzle-review-screen';
import { ChessStatsBody } from './chess-stats-body';

export function PersonalChessStatsScreen(): JSX.Element {
  const [puzzleId, setPuzzleId] = createSignal<string | null>(null);
  const [solveIdx, setSolveIdx] = createSignal(0);
  const review = (id: string): void => {
    setSolveIdx(0);
    setPuzzleId(id);
  };
  return (
    <ChessPuzzleFeedProvider>
      <CollectionScreen
        screenId="personal-chess-stats"
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
            <ChessStatsBody
              titled={false}
              onSelectEntry={(entry) => review(entry.puzzleId)}
            />
          }
        >
          {(id) => (
            <ChessPuzzleReviewBody
              puzzleId={id}
              cursor={{ solveIdx, seek: setSolveIdx }}
            />
          )}
        </Show>
      </CollectionScreen>
    </ChessPuzzleFeedProvider>
  );
}
