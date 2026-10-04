import { type JSX, Show } from 'solid-js';

import type { ChessMoveNotation } from '@libs/chess-puzzle-shared/chess-puzzle-notation';
import { formatSanNotation } from '@libs/chess-puzzle-shared/chess-puzzle-notation';
import type { PuzzleHistoryPly } from '@libs/chess-puzzle-shared/chess-puzzle-move-history';
import { CHESS_PUZZLE_TEST_ENABLED } from '@libs/chess-puzzle-shared/chess-puzzle-test-enabled';

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
  return (
    <p class="text textCaption text-text-secondary font-semibold pr-1">
      {label}
    </p>
  );
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
      class="clickable px-1.5 py-0.5 rounded-xs"
      style={{ background: props.selected ? 'successSurface' : 'transparent' }}
      data-testid={`chess-puzzle-move-ply-${props.ply.plyIndex}`}
      type="button"
      disabled={!props.interactive || props.selected}
      onClick={handlePress}
      role="button"
      aria-pressed={props.selected}
      aria-label={props.ply.san}
    >
      <code
        class="text textMono"
        style={{
          color: props.selected ? 'success' : 'text',
          'font-weight': props.selected ? '700' : '600',
        }}
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
      <span
        style={{ position: 'absolute', width: '1px', height: '1px' }}
        data-testid="chess-puzzle-move-ply-selected"
      >
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
