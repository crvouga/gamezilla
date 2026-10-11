import type { PuzzleHistoryPly } from '@libs/chess-puzzle-shared/chess-puzzle-move-history';

import type { ChessMoveNotation } from '@libs/chess-puzzle-shared/chess-puzzle-notation';
import { formatSanNotation } from '@libs/chess-puzzle-shared/chess-puzzle-notation';
import { CHESS_PUZZLE_TEST_ENABLED } from '@libs/chess-puzzle-shared/chess-puzzle-test-enabled';
import { type JSX, Show } from 'solid-js';

type HistoryPlyChipProps = {
  ply: PuzzleHistoryPly;
  selected: boolean;
  interactive: boolean;
  notation: ChessMoveNotation;
  onSeek: (solveIdx: number) => void;
};

function MoveNumberLabel(props: {
  moveNumber: number;
  ellipsis: boolean;
}): JSX.Element {
  const label = props.ellipsis
    ? `${props.moveNumber}...`
    : `${props.moveNumber}.`;
  return <p class="text textCaption textNumeral pr-1">{label}</p>;
}

export function moveNumberPrefix(
  ply: PuzzleHistoryPly
): { moveNumber: number; ellipsis: boolean } | null {
  if (ply.color === 'w') {
    return { moveNumber: ply.moveNumber, ellipsis: false };
  }
  if (ply.plyIndex === 0) {
    return { moveNumber: ply.moveNumber, ellipsis: true };
  }
  return null;
}

function HistoryPlyChip(props: HistoryPlyChipProps): JSX.Element {
  const handlePress = (): void => {
    props.onSeek(props.ply.solveIdxAfter);
  };
  return (
    <button
      class="clickable px-2 py-0.5 rounded-sm"
      classList={{ 'bg-success-surface': props.selected }}
      data-testid={`chess-puzzle-move-ply-${props.ply.plyIndex}`}
      type="button"
      disabled={!props.interactive || props.selected}
      onClick={handlePress}
      role="button"
      aria-pressed={props.selected}
      aria-label={props.ply.san}
    >
      <code
        class="text textLabel textNumeral"
        classList={{ 'text-success': props.selected }}
      >
        {formatSanNotation(props.ply.san, props.notation)}
      </code>
    </button>
  );
}

/**
 * Test-only marker on whichever chip the move list is highlighting, rendered
 * from the same `selected` branch as the highlight itself — so a scenario
 * asserts the §7 "current move highlighted" rule, not a parallel signal.
 */
function SelectedPlyProbe(props: {
  ply: PuzzleHistoryPly;
  selected: boolean;
}): JSX.Element {
  if (!CHESS_PUZZLE_TEST_ENABLED) return <></>;
  return (
    <Show when={props.selected}>
      <span class="sr-only" data-testid="chess-puzzle-move-ply-selected">
        {`${props.ply.plyIndex}|${props.ply.san}`}
      </span>
    </Show>
  );
}

export function HistoryPlyCluster(props: {
  ply: PuzzleHistoryPly;
  selectedSolveIdx: number;
  interactive: boolean;
  notation: ChessMoveNotation;
  onSeek: (solveIdx: number) => void;
  selectedRef?: (el: HTMLElement) => void;
}): JSX.Element {
  const prefix = moveNumberPrefix(props.ply);
  return (
    <div
      class="box flex-row items-center gap-1 shrink-0 grow-0"
      ref={props.selectedRef}
    >
      {prefix !== null ? (
        <MoveNumberLabel
          moveNumber={prefix.moveNumber}
          ellipsis={prefix.ellipsis}
        />
      ) : null}
      <HistoryPlyChip
        ply={props.ply}
        selected={props.ply.solveIdxAfter === props.selectedSolveIdx}
        interactive={props.interactive}
        notation={props.notation}
        onSeek={props.onSeek}
      />
      <SelectedPlyProbe
        ply={props.ply}
        selected={props.ply.solveIdxAfter === props.selectedSolveIdx}
      />
    </div>
  );
}
