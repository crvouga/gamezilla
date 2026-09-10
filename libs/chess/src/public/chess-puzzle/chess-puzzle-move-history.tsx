import { ScrollView } from '@pkgs/ui';
import { createEffect, createSignal, For, type JSX, Show } from 'solid-js';

import type { PuzzleHistoryPly } from '../chess-puzzle-move-history';
import { HistoryPlyCluster } from './chess-puzzle-move-history-ply';

const ROW_HEIGHT = 28;

export type ChessPuzzleMoveHistoryProps = {
  plies: readonly PuzzleHistoryPly[];
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
};

function MoveHistoryScroll(props: {
  plies: readonly PuzzleHistoryPly[];
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
}): JSX.Element {
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
    <div
      class="box self-stretch bg-surface-muted rounded-[8px] justify-center"
      style={{ height: `${ROW_HEIGHT}px` }}
      data-testid="chess-puzzle-move-history"
    >
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
              onSeek={props.onSeek}
              selectedRef={resolveRef(ply)}
            />
          )}
        </For>
      </ScrollView>
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
          class="box self-stretch bg-surface-muted rounded-[8px]"
          style={{ height: `${ROW_HEIGHT}px` }}
          data-testid="chess-puzzle-move-history"
        />
      }
    >
      <MoveHistoryScroll
        plies={props.plies}
        selectedSolveIdx={props.selectedSolveIdx}
        interactive={props.interactive}
        onSeek={props.onSeek}
      />
    </Show>
  );
}
