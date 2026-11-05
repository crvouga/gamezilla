import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared-ts/move-history';
import { puzzleSwipeHandlers } from '@libs/game-puzzle-shared-ts/puzzle-swipe-handlers';
import { Trans } from '@lingui/solid/macro';
import { MoveStrip } from '@pkgs/ui-root-client-ts/move-strip';
import { createScrollTarget } from '@pkgs/ui-root-client-ts/scroll';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createEffect, For, type JSX, Show } from 'solid-js';
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
  // The selected move's cluster holds the target; keep it in view.
  const selected = createScrollTarget();
  createEffect(() => {
    void props.selectedSolveIdx;
    selected.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  });
  return (
    <For each={props.plies}>
      {(ply) => (
        <HistoryPlyCluster
          ply={ply}
          selectedSolveIdx={props.selectedSolveIdx}
          interactive={props.interactive}
          writing={props.writing}
          onSeek={props.onSeek}
          scrollTarget={
            ply.solveIdxAfter === props.selectedSolveIdx
              ? selected.target
              : undefined
          }
        />
      )}
    </For>
  );
}

/**
 * The line played so far, named ("Moves") at the page's inset on the same
 * line as its controls, so a chip such as `4… g6` reads as a move and the
 * name never floats alone above them: nav buttons right beside the
 * scrubbable move list (a puzzle's line is short), and a horizontal swipe
 * over both. With no moves yet the row stays empty at its full height, so
 * the board above keeps its size when the first move lands.
 */
export function PuzzleMoveHistory(props: PuzzleMoveHistoryProps): JSX.Element {
  const swipe = puzzleSwipeHandlers((intent) => props.nav.onNavigate(intent));
  const hasPlies = (): boolean => props.plies.length > 0;
  return (
    <StackHorizontal align="center" gap="sm" paddingX="lg">
      <P variant="caption" tone="secondary" testId="chess-puzzle-moves-label">
        <Trans>Moves</Trans>
      </P>
      <StackVertical shrink>
        <MoveStrip
          testId="chess-puzzle-move-history"
          fit="content"
          pointer={hasPlies() ? swipe : undefined}
          leading={
            <Show when={hasPlies()}>
              <PuzzleMoveNav side="leading" nav={props.nav} />
            </Show>
          }
          trailing={
            <Show when={hasPlies()}>
              <PuzzleMoveNav side="trailing" nav={props.nav} />
            </Show>
          }
        >
          <Show when={hasPlies()}>
            <MoveHistoryPlies {...props} />
          </Show>
        </MoveStrip>
      </StackVertical>
    </StackHorizontal>
  );
}
