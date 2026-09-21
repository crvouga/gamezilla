import { ScrollView } from '@pkgs/ui';
import { createEffect, createSignal, For, type JSX, Show } from 'solid-js';

import type { ChessMoveNotation } from '../../shared/chess/chess-puzzle-notation';
import type { PuzzleHistoryPly } from '../chess-puzzle-move-history';
import {
  ChessPuzzleMoveNav,
  type ChessPuzzleMoveNavProps,
} from './chess-puzzle-move-history-nav';
import { HistoryPlyCluster } from './chess-puzzle-move-history-ply';
import { puzzleSwipeHandlers } from './puzzle-swipe-handlers';

const ROW_HEIGHT = 28;

export type ChessPuzzleMoveHistoryProps = {
  plies: readonly PuzzleHistoryPly[];
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
  /** §7 jump-to-start / jump-to-end (and step controls on review). */
  nav: ChessPuzzleMoveNavProps;
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
      class="flex-1 min-w-[0]"
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
      <ChessPuzzleMoveNav side="leading" nav={props.nav} />
      <MoveHistoryScroll {...props} />
      <ChessPuzzleMoveNav side="trailing" nav={props.nav} />
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
