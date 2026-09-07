import { Box, ScrollView } from '@pkgs/ui';
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
    <Box
      dataSet={{ testid: 'chess-puzzle-move-history' }}
      sx={{
        alignSelf: 'stretch',
        height: ROW_HEIGHT,
        background: 'surfaceMuted',
        borderRadius: 8,
        justifyContent: 'center',
      }}
    >
      <ScrollView
        horizontal
        hideScrollbar
        frameSx={{ flex: 1, minWidth: 0 }}
        sx={{
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          px: 3,
          gap: 2,
          minHeight: ROW_HEIGHT,
        }}
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
    </Box>
  );
}

export function ChessPuzzleMoveHistory(
  props: ChessPuzzleMoveHistoryProps
): JSX.Element {
  return (
    <Show
      when={props.plies.length > 0}
      fallback={
        <Box
          dataSet={{ testid: 'chess-puzzle-move-history' }}
          sx={{
            alignSelf: 'stretch',
            height: ROW_HEIGHT,
            background: 'surfaceMuted',
            borderRadius: 8,
          }}
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
