import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared-ts/move-history';
import { puzzleSwipeHandlers } from '@libs/game-puzzle-shared-ts/puzzle-swipe-handlers';
import { Trans } from '@lingui/solid/macro';
import { createMeasure } from '@pkgs/ui-root-client-ts/measure';
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

function MoveHistoryPlies(
  props: PuzzleMoveHistoryProps & {
    /** The strip's width: its moves are revealed again once it settles. */
    readonly stripWidth: () => number;
  }
): JSX.Element {
  // The selected move's cluster holds the target; keep it in view. Only the
  // strip scrolls (never the page). A new selection glides to it; a strip
  // or a row of moves that is laid out or resized (its type loading) jumps
  // to it at once, so the selected move is fully in view at rest.
  const selected = createScrollTarget();
  const row = createMeasure();
  let shownIdx: number | null = null;
  createEffect(() => {
    const idx = props.selectedSolveIdx;
    void props.stripWidth();
    void row.width();
    const moved = shownIdx !== null && shownIdx !== idx;
    if (
      selected.scrollIntoView({
        behavior: moved ? 'smooth' : 'instant',
        inline: 'center',
        scope: 'scroller',
      })
    )
      shownIdx = idx;
  });
  return (
    <StackHorizontal align="center" gap="sm" measureTarget={row.target}>
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
    </StackHorizontal>
  );
}

/**
 * The line played so far, named ("Moves") at the page's inset like a game's
 * record, so a chip such as `4… g6` reads as a move: nav buttons right
 * beside the scrubbable move list (a puzzle's line is short), and a
 * horizontal swipe over both. With no moves yet the row stays empty at its
 * full height, so the board above keeps its size when the first move lands.
 */
export function PuzzleMoveHistory(props: PuzzleMoveHistoryProps): JSX.Element {
  const swipe = puzzleSwipeHandlers((intent) => props.nav.onNavigate(intent));
  const hasPlies = (): boolean => props.plies.length > 0;
  const strip = createMeasure();
  return (
    <StackVertical gap="xs">
      <StackVertical paddingX="lg">
        <P variant="caption" tone="secondary" testId="chess-puzzle-moves-label">
          <Trans>Moves</Trans>
        </P>
      </StackVertical>
      <StackVertical measureTarget={strip.target}>
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
            <MoveHistoryPlies {...props} stripWidth={strip.width} />
          </Show>
        </MoveStrip>
      </StackVertical>
    </StackVertical>
  );
}
