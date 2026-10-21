import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared/move-history';
import { puzzleSwipeHandlers } from '@libs/game-puzzle-shared/puzzle-swipe-handlers';
import { MoveStrip } from '@pkgs/ui-root-client/move-strip';
import { createScrollTarget } from '@pkgs/ui-root-client/scroll';
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
 * Nav buttons, the scrubbable move list, and a horizontal swipe over both.
 * With no moves yet the row stays empty at its full height, so the board
 * above keeps its size when the first move lands.
 */
export function PuzzleMoveHistory(props: PuzzleMoveHistoryProps): JSX.Element {
  const swipe = puzzleSwipeHandlers((intent) => props.nav.onNavigate(intent));
  const hasPlies = (): boolean => props.plies.length > 0;
  return (
    <MoveStrip
      testId="chess-puzzle-move-history"
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
  );
}
