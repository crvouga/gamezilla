import type { PuzzleHistoryPly } from '@libs/chess-puzzle-shared/chess-puzzle-move-history';
import type { ChessMoveNotation } from '@libs/chess-puzzle-shared/chess-puzzle-notation';
import type { PuzzleMoveNavProps } from '@libs/game-puzzle-client/puzzle-move-history-nav';
import { PuzzleMoveNav } from '@libs/game-puzzle-client/puzzle-move-history-nav';
import { puzzleSwipeHandlers } from '@libs/game-puzzle-shared/puzzle-swipe-handlers';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { createEffect, createSignal, For, type JSX, Show } from 'solid-js';
import { HistoryPlyCluster } from './chess-puzzle-move-history-ply';

const ROW_HEIGHT = 28;

export type ChessPuzzleMoveHistoryProps = {
  plies: readonly PuzzleHistoryPly[];
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
  /** §7 jump-to-start / jump-to-end (and step controls on review). */
  nav: PuzzleMoveNavProps;
  notation: ChessMoveNotation;
};

function MoveHistoryScroll(props: ChessPuzzleMoveHistoryProps): JSX.Element {
  const [selectedEl, setSelectedEl] = createSignal<HTMLElement>();

  createEffect(() => {
    const el = selectedEl();
    void props.selectedSolveIdx;
    if (el !== undefined && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  });

  const resolveRef = (ply: PuzzleHistoryPly) => (el: HTMLElement) => {
    if (ply.solveIdxAfter === props.selectedSolveIdx) setSelectedEl(el);
  };

  return (
    <ScrollView
      class="flex-1 min-w-0"
      contentClass="flex-row flex-nowrap items-center px-3 gap-2"
      contentStyle={{ 'min-height': `${ROW_HEIGHT}px` }}
      horizontal
      hideScrollbar
    >
      <For each={props.plies}>
        {(ply) => (
          <HistoryPlyCluster
            ply={ply}
            selectedSolveIdx={props.selectedSolveIdx}
            interactive={props.interactive}
            notation={props.notation}
            onSeek={props.onSeek}
            selectedRef={resolveRef(ply)}
          />
        )}
      </For>
    </ScrollView>
  );
}

/** Nav buttons, the scrubbable move list, and a horizontal swipe over both. */
function MoveHistoryRow(props: ChessPuzzleMoveHistoryProps): JSX.Element {
  const swipe = puzzleSwipeHandlers((intent) => props.nav.onNavigate(intent));
  return (
    <div
      class="box flex-row items-center self-stretch justify-center"
      style={{ height: `${ROW_HEIGHT}px` }}
      data-testid="chess-puzzle-move-history"
      onPointerDown={swipe.onPointerDown}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
    >
      <PuzzleMoveNav side="leading" nav={props.nav} />
      <MoveHistoryScroll {...props} />
      <PuzzleMoveNav side="trailing" nav={props.nav} />
    </div>
  );
}

export function ChessPuzzleMoveHistory(
  props: ChessPuzzleMoveHistoryProps
): JSX.Element {
  return (
    <Show
      when={props.plies.length > 0}
      fallback={
        <div
          class="box self-stretch"
          style={{ height: `${ROW_HEIGHT}px` }}
          data-testid="chess-puzzle-move-history"
        />
      }
    >
      <MoveHistoryRow {...props} />
    </Show>
  );
}
