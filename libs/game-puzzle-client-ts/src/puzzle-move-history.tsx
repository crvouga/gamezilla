import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared-ts/move-history';
import { puzzleSwipeHandlers } from '@libs/game-puzzle-shared-ts/puzzle-swipe-handlers';
import { Trans } from '@lingui/solid/macro';
import { MoveStrip } from '@pkgs/ui-root-client-ts/move-strip';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import type { PuzzleMoveNavProps } from './puzzle-move-history-nav';
import { PuzzleMoveNav } from './puzzle-move-history-nav';
import { HistoryPlyCluster } from './puzzle-move-history-ply';
import type { PuzzleMoveWriting } from './use-puzzle-notation';

export type PuzzleMoveHistoryProps = {
  plies: readonly PuzzleHistoryPly[];
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
  /** §7 jump-to-start / jump-to-end (and step controls on review). */
  nav: PuzzleMoveNavProps;
  writing: PuzzleMoveWriting;
};

function MoveHistoryPlies(props: PuzzleMoveHistoryProps): JSX.Element {
  return (
    <For each={props.plies}>
      {(ply) => (
        <HistoryPlyCluster
          ply={ply}
          selectedSolveIdx={props.selectedSolveIdx}
          interactive={props.interactive}
          writing={props.writing}
          onSeek={props.onSeek}
        />
      )}
    </For>
  );
}

/**
 * The line played so far. Its name ("Moves") heads it on a row of its
 * own, with the jump and step buttons at that row's end; the moves take
 * the whole width under it and wrap onto a further row rather than
 * scroll, so every move shows whole: a name squeezed inline broke
 * mid-word ("Mov / es") and a scrolling strip cut a chip at its edge
 * ("ке5"). A horizontal swipe over the moves steps through them. With no
 * moves yet the row stays empty at its full height, so nothing under the
 * board jumps when the first move lands.
 */
export function PuzzleMoveHistory(props: PuzzleMoveHistoryProps): JSX.Element {
  const swipe = puzzleSwipeHandlers((intent) => props.nav.onNavigate(intent));
  const hasPlies = (): boolean => props.plies.length > 0;
  return (
    <StackVertical gap="xs" paddingX="lg" testId="chess-puzzle-moves">
      <StackHorizontal align="center" justify="between" gap="sm">
        <P
          variant="caption"
          tone="secondary"
          wrap="nowrap"
          testId="chess-puzzle-moves-label"
        >
          <Trans>Moves</Trans>
        </P>
        <Show when={hasPlies()}>
          <StackHorizontal align="center" gap="xs">
            <PuzzleMoveNav side="leading" nav={props.nav} />
            <PuzzleMoveNav side="trailing" nav={props.nav} />
          </StackHorizontal>
        </Show>
      </StackHorizontal>
      <MoveStrip
        testId="chess-puzzle-move-history"
        overflow="wrap"
        pointer={hasPlies() ? swipe : undefined}
      >
        <Show when={hasPlies()}>
          <MoveHistoryPlies {...props} />
        </Show>
      </MoveStrip>
    </StackVertical>
  );
}
